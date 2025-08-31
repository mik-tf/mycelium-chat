"""
ThreeFold Connect authentication provider for Synapse Matrix homeserver.
Based on the working implementation from web-archive/src/services/tfconnect.ts
"""

import logging
import json
import asyncio
import websockets
import requests
import yaml
import time
import hashlib
import redis
import base64
import os
from urllib.parse import urlencode
from typing import Dict, Optional, Any, List
from twisted.internet import defer
from synapse.module_api import ModuleApi
from synapse.http.servlet import parse_json_object_from_request
from synapse.api.errors import LoginError, AuthError
from synapse.types import UserID
from cryptography.fernet import Fernet
import jwt
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class TFConnectAuthProvider:
    def __init__(self, config: dict, account_handler):
        self.account_handler = account_handler
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # Load configuration from YAML file
        config_file = config.get("config_file", "/config/config.yaml")
        with open(config_file, 'r') as f:
            self.tf_config = yaml.safe_load(f)['tf_connect']
        
        # TF Connect configuration
        self.tf_connect_url = self.tf_config.get("api_base_url", "https://login.threefold.me")
        self.app_id = self.tf_config.get("app_id", "mycelium-chat")
        self.websocket_url = self.tf_config.get("websocket_url", "wss://login.threefold.me/websocket")
        self.redirect_uri = self.tf_config.get("redirect_uri", "https://chat.threefold.pro/auth/callback")
        
        # Development mode settings
        if self.tf_config.get("dev_mode", False):
            self.tf_connect_url = self.tf_config.get("dev_api_base_url", self.tf_connect_url)
            self.websocket_url = self.tf_config.get("dev_websocket_url", self.websocket_url)
        
        # Security settings
        self.session_timeout = self.tf_config.get("session_timeout", 3600)
        self.max_login_attempts = self.tf_config.get("max_login_attempts", 5)
        self.rate_limit_window = self.tf_config.get("rate_limit_window", 300)
        
        # Initialize Redis for session storage
        try:
            self.redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
            self.redis_client.ping()
        except Exception as e:
            self.logger.warning(f"Redis not available, using in-memory storage: {e}")
            self.redis_client = None
        
        # Session storage for pending authentications
        self.pending_sessions = {}
        self.rate_limit_cache = {}
        
        # User cache
        self.user_cache = {}
        self.user_cache_ttl = self.tf_config.get("user_cache_ttl", 1800)
        
        # Register authentication type
        self.account_handler.register_password_auth_provider_callbacks(
            check_auth=self.check_auth,
            get_supported_login_types=self.get_supported_login_types,
        )
        
        # Register web resource for callback handling
        self.account_handler.register_web_resource(
            path="/_matrix/client/r0/login/tf_connect",
            resource=TFConnectResource(self)
        )
        
        logger.info("TF Connect authentication provider initialized")
    
    async def get_supported_login_types(self) -> Dict[str, Any]:
        """Return supported login types including TF Connect"""
        return {
            "org.threefold.connect": ["tf_connect_token"],
            "m.login.password": ["password"],  # Keep password as fallback
        }
    
    async def check_auth(self, username: str, login_type: str, login_dict: Dict[str, Any]) -> Optional[str]:
        """Check if the provided login is valid for TF Connect authentication."""
        if login_type != "tf_connect":
            return None
            
        try:
            # Rate limiting check
            client_ip = login_dict.get("client_ip", "unknown")
            if not self._check_rate_limit(client_ip):
                raise LoginError(429, "Too many login attempts", "M_LIMIT_EXCEEDED")
            
            # Extract TF Connect token from login request
            tf_token = login_dict.get("tf_token")
            session_id = login_dict.get("session_id")
            
            if not tf_token and not session_id:
                raise LoginError(400, "Missing TF Connect token or session ID", "M_MISSING_PARAM")
            
            # Handle different authentication flows
            if tf_token:
                # Direct token verification
                user_info = await self._verify_tf_token(tf_token)
            elif session_id:
                # Session-based authentication (WebSocket flow)
                user_info = await self._verify_session(session_id)
            else:
                raise LoginError(400, "Invalid authentication parameters", "M_INVALID_PARAM")
            
            if not user_info:
                self._record_failed_attempt(client_ip)
                raise LoginError(401, "Invalid TF Connect credentials", "M_FORBIDDEN")
            
            # Validate user against allowed domains if configured
            if not self._is_user_allowed(user_info):
                raise LoginError(403, "User not authorized for this service", "M_FORBIDDEN")
            
            # Map TF Connect user to Matrix user ID
            matrix_user_id = self._map_tf_user_to_matrix(user_info)
            
            # Create or update user account
            await self._ensure_user_exists(matrix_user_id, user_info)
            
            # Cache user info
            self._cache_user_info(matrix_user_id, user_info)
            
            return matrix_user_id
            
        except LoginError:
            raise
        except Exception as e:
            self.logger.error(f"TF Connect authentication failed: {e}")
            raise LoginError(500, "Authentication failed", "M_UNKNOWN")

    async def _verify_tf_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify TF Connect token and return user information."""
        try:
            # Check token cache first
            cached_user = self._get_cached_token(token)
            if cached_user:
                return cached_user
            
            # Make request to TF Connect API to verify token
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "User-Agent": f"MyceliumChat/{self.app_id}"
            }
            
            response = requests.get(
                f"{self.tf_connect_url}/api/users/me",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                user_info = response.json()
                # Cache the token verification result
                self._cache_token(token, user_info)
                return user_info
            elif response.status_code == 401:
                self.logger.warning("TF Connect token expired or invalid")
                return None
            else:
                self.logger.warning(f"TF Connect token validation failed: {response.status_code}")
                return None
                
        except requests.RequestException as e:
            self.logger.error(f"Network error verifying TF Connect token: {e}")
            return None
        except Exception as e:
            self.logger.error(f"Error verifying TF Connect token: {e}")
            return None
    
    async def _verify_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Verify session-based authentication (WebSocket flow)"""
        try:
            # Get session data from storage
            session_data = self._get_session(session_id)
            if not session_data:
                return None
            
            # Check if session is still valid
            if time.time() - session_data.get('created_at', 0) > self.session_timeout:
                self._remove_session(session_id)
                return None
            
            return session_data.get('user_info')
        except Exception as e:
            self.logger.error(f"Error verifying session: {e}")
            return None
    
    def _map_tf_user_to_matrix(self, user_info: Dict[str, Any]) -> str:
        """Map TF Connect user to Matrix user ID"""
        username = user_info.get('doubleName', user_info.get('username', 'unknown'))
        # Clean username for Matrix compatibility
        clean_username = username.replace('.', '_').replace('@', '_').lower()
        server_name = self.tf_config.get('server_name', 'matrix.localhost')
        return f"@{clean_username}:{server_name}"
    
    async def _ensure_user_exists(self, user_id: str, user_info: Dict[str, Any]):
        """Create or update Matrix user account"""
        try:
            # Check if user already exists
            existing_user = await self.account_handler.check_user_exists(user_id)
            
            if not existing_user:
                # Create new user
                await self.account_handler.register_user(
                    localpart=user_id.split(':')[0][1:],  # Remove @ and domain
                    password=None,  # No password for TF Connect users
                    displayname=user_info.get('name', user_info.get('doubleName', 'Unknown')),
                    emails=[user_info.get('email')] if user_info.get('email') else [],
                )
                self.logger.info(f"Created new Matrix user: {user_id}")
            else:
                # Update existing user profile if needed
                display_name = user_info.get('name', user_info.get('doubleName', 'Unknown'))
                await self.account_handler.set_displayname(user_id, display_name)
                self.logger.info(f"Updated user profile for {user_id}")
                    
        except Exception as e:
            self.logger.error(f"Failed to ensure user exists: {e}")
            raise
    
    def _check_rate_limit(self, client_ip: str) -> bool:
        """Check if client IP is within rate limits"""
        current_time = time.time()
        
        # Clean old entries
        self.rate_limit_cache = {
            ip: attempts for ip, attempts in self.rate_limit_cache.items()
            if current_time - attempts[-1] < self.rate_limit_window
        }
        
        # Check current IP
        attempts = self.rate_limit_cache.get(client_ip, [])
        recent_attempts = [t for t in attempts if current_time - t < self.rate_limit_window]
        
        return len(recent_attempts) < self.max_login_attempts
    
    def _record_failed_attempt(self, client_ip: str):
        """Record a failed login attempt"""
        current_time = time.time()
        if client_ip not in self.rate_limit_cache:
            self.rate_limit_cache[client_ip] = []
        self.rate_limit_cache[client_ip].append(current_time)
    
    def _is_user_allowed(self, user_info: Dict[str, Any]) -> bool:
        """Check if user is allowed based on domain restrictions"""
        allowed_domains = self.tf_config.get('allowed_domains', [])
        if not allowed_domains:  # No restrictions
            return True
        
        email = user_info.get('email', '')
        if not email:
            return False
        
        domain = email.split('@')[-1].lower()
        return domain in allowed_domains
    
    def _cache_user_info(self, user_id: str, user_info: Dict[str, Any]):
        """Cache user information"""
        cache_key = f"user:{user_id}"
        cache_data = {
            'user_info': user_info,
            'cached_at': time.time()
        }
        
        if self.redis_client:
            try:
                self.redis_client.setex(
                    cache_key, 
                    self.user_cache_ttl, 
                    json.dumps(cache_data)
                )
            except Exception as e:
                self.logger.warning(f"Failed to cache user info in Redis: {e}")
                self.user_cache[user_id] = cache_data
        else:
            self.user_cache[user_id] = cache_data
    
    def _get_cached_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Get cached token verification result"""
        cache_key = f"token:{hashlib.sha256(token.encode()).hexdigest()}"
        
        if self.redis_client:
            try:
                cached = self.redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception as e:
                self.logger.warning(f"Failed to get cached token from Redis: {e}")
        
        return None
    
    def _cache_token(self, token: str, user_info: Dict[str, Any]):
        """Cache token verification result"""
        cache_key = f"token:{hashlib.sha256(token.encode()).hexdigest()}"
        cache_ttl = self.tf_config.get('token_cache_ttl', 3600)
        
        if self.redis_client:
            try:
                self.redis_client.setex(
                    cache_key,
                    cache_ttl,
                    json.dumps(user_info)
                )
            except Exception as e:
                self.logger.warning(f"Failed to cache token in Redis: {e}")
    
    def _get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session data"""
        if self.redis_client:
            try:
                session_data = self.redis_client.get(f"session:{session_id}")
                return json.loads(session_data) if session_data else None
            except Exception as e:
                self.logger.warning(f"Failed to get session from Redis: {e}")
        
        return self.pending_sessions.get(session_id)
    
    def _remove_session(self, session_id: str):
        """Remove session data"""
        if self.redis_client:
            try:
                self.redis_client.delete(f"session:{session_id}")
            except Exception as e:
                self.logger.warning(f"Failed to remove session from Redis: {e}")
        
        self.pending_sessions.pop(session_id, None)

class TFConnectResource:
    """Web resource for handling TF Connect authentication callbacks"""
    
    def __init__(self, auth_provider: TFConnectAuthProvider):
        self.auth_provider = auth_provider
    
    def render_GET(self, request):
        """Handle TF Connect authentication initiation"""
        # Generate state for CSRF protection
        state = base64.urlsafe_b64encode(os.urandom(32)).decode('utf-8')
        
        # Store state in session (simplified)
        request.getSession().state = state
        
        # Build TF Connect authentication URL
        params = {
            "state": state,
            "scope": "user:email:verified",
            "redirectUrl": self.auth_provider.redirect_uri,
            "appId": self.auth_provider.app_id,
        }
        
        auth_url = f"{self.auth_provider.tf_connect_url}?{urlencode(params)}"
        
        # Return JavaScript that opens TF Connect popup
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>ThreeFold Connect Login</title>
        </head>
        <body>
            <script>
                // Based on working implementation from web-archive
                function initiateTFConnectAuth() {{
                    const popup = window.open(
                        '{auth_url}',
                        'tfconnect',
                        'width=400,height=600,scrollbars=yes,resizable=yes'
                    );
                    
                    // Monitor popup for completion
                    const checkClosed = setInterval(() => {{
                        if (popup.closed) {{
                            clearInterval(checkClosed);
                            window.location.href = '/';
                        }}
                    }}, 1000);
                    
                    // Listen for authentication completion
                    window.addEventListener('message', (event) => {{
                        if (event.origin === 'https://login.threefold.me') {{
                            popup.close();
                            clearInterval(checkClosed);
                            
                            // Process authentication result
                            if (event.data && event.data.signedAttempt) {{
                                // Send to Matrix login endpoint
                                fetch('/_matrix/client/r0/login', {{
                                    method: 'POST',
                                    headers: {{
                                        'Content-Type': 'application/json'
                                    }},
                                    body: JSON.stringify({{
                                        type: 'org.threefold.connect',
                                        tf_connect_token: event.data.signedAttempt
                                    }})
                                }})
                                .then(response => response.json())
                                .then(data => {{
                                    if (data.access_token) {{
                                        // Store token and redirect to Element
                                        localStorage.setItem('mx_access_token', data.access_token);
                                        localStorage.setItem('mx_user_id', data.user_id);
                                        window.location.href = '/';
                                    }} else {{
                                        alert('Authentication failed');
                                    }}
                                }})
                                .catch(error => {{
                                    console.error('Login error:', error);
                                    alert('Authentication failed');
                                }});
                            }}
                        }}
                    }});
                }}
                
                // Auto-start authentication
                initiateTFConnectAuth();
            </script>
            <p>Redirecting to ThreeFold Connect...</p>
        </body>
        </html>
        """
        
        request.setHeader(b"content-type", b"text/html")
        return html.encode('utf-8')

def parse_config(config_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Parse module configuration"""
    return config_dict

def create_module(config: Dict[str, Any], api: ModuleApi) -> TFConnectAuthProvider:
    """Module entry point for Synapse"""
    return TFConnectAuthProvider(config, api)
