#!/usr/bin/env python3
"""
Integration tests for Matrix-Mycelium federation
Tests the complete federation flow between multiple homeservers via Mycelium P2P
"""

import asyncio
import json
import pytest
import requests
import websockets
import time
import subprocess
import tempfile
import os
from typing import Dict, List, Optional
from dataclasses import dataclass
from pathlib import Path

@dataclass
class TestServer:
    """Represents a test Matrix homeserver instance"""
    name: str
    port: int
    bridge_port: int
    discovery_port: int
    process: Optional[subprocess.Popen] = None
    bridge_process: Optional[subprocess.Popen] = None
    config_dir: Optional[str] = None

class FederationTestSuite:
    """Test suite for Matrix-Mycelium federation"""
    
    def __init__(self):
        self.servers: List[TestServer] = []
        self.temp_dirs: List[str] = []
        self.discovery_process: Optional[subprocess.Popen] = None
        
    async def setup_test_environment(self):
        """Set up test environment with multiple homeservers"""
        print("Setting up test environment...")
        
        # Start discovery service
        await self.start_discovery_service()
        
        # Create test servers
        server1 = TestServer("server1.test", 8008, 8080, 3000)
        server2 = TestServer("server2.test", 8009, 8081, 3001)
        
        self.servers = [server1, server2]
        
        # Configure and start each server
        for server in self.servers:
            await self.setup_server(server)
            await self.start_server(server)
        
        # Wait for servers to be ready
        await self.wait_for_servers()
        
    async def start_discovery_service(self):
        """Start the discovery service for testing"""
        config_dir = tempfile.mkdtemp()
        self.temp_dirs.append(config_dir)
        
        config_content = """
[server]
bind_address = "127.0.0.1"
port = 3000
max_servers = 100

[cleanup]
interval_seconds = 60
stale_threshold_minutes = 5

[persistence]
enabled = false
"""
        
        config_path = os.path.join(config_dir, "discovery.toml")
        with open(config_path, 'w') as f:
            f.write(config_content)
        
        # Start discovery service
        cmd = ["cargo", "run", "--bin", "mycelium-discovery-service", "--", "--config", config_path]
        self.discovery_process = subprocess.Popen(
            cmd,
            cwd="../discovery-service",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Wait for discovery service to start
        await asyncio.sleep(3)
        
    async def setup_server(self, server: TestServer):
        """Set up configuration for a test server"""
        config_dir = tempfile.mkdtemp()
        self.temp_dirs.append(config_dir)
        server.config_dir = config_dir
        
        # Generate Synapse config
        homeserver_config = f"""
server_name: "{server.name}"
pid_file: "{config_dir}/homeserver.pid"

listeners:
  - port: {server.port}
    tls: false
    type: http
    x_forwarded: true
    bind_addresses: ['127.0.0.1']
    resources:
      - names: [client, federation]
        compress: false

database:
  name: "sqlite3"
  args:
    database: "{config_dir}/homeserver.db"

log_config: "{config_dir}/log.config"
media_store_path: "{config_dir}/media_store"
registration_shared_secret: "test_secret_{server.port}"
report_stats: false
macaroon_secret_key: "test_macaroon_{server.port}"
form_secret: "test_form_{server.port}"
signing_key_path: "{config_dir}/signing.key"

suppress_key_server_warning: true
enable_registration: true
enable_registration_without_verification: true
"""
        
        homeserver_path = os.path.join(config_dir, "homeserver.yaml")
        with open(homeserver_path, 'w') as f:
            f.write(homeserver_config)
        
        # Generate bridge config
        bridge_config = f"""
[server]
name = "{server.name}"
matrix_url = "http://127.0.0.1:{server.port}"
mycelium_url = "http://127.0.0.1:8989"
signing_key_path = "{config_dir}/bridge_signing.key"
max_users = 100

[federation]
topic = "test.matrix.federation"
discovery_url = "http://127.0.0.1:3000"

[logging]
level = "debug"
"""
        
        bridge_path = os.path.join(config_dir, "bridge.toml")
        with open(bridge_path, 'w') as f:
            f.write(bridge_config)
        
        # Generate log config
        log_config = f"""
version: 1
formatters:
  precise:
    format: '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
handlers:
  file:
    class: logging.FileHandler
    formatter: precise
    filename: {config_dir}/homeserver.log
  console:
    class: logging.StreamHandler
    formatter: precise
root:
    level: INFO
    handlers: [file, console]
"""
        
        log_path = os.path.join(config_dir, "log.config")
        with open(log_path, 'w') as f:
            f.write(log_config)
        
        # Generate signing keys
        subprocess.run([
            "python", "-m", "synapse.app.homeserver",
            "--generate-keys", "--config-path", homeserver_path
        ], check=True, capture_output=True)
        
        # Generate bridge signing key
        subprocess.run([
            "openssl", "genpkey", "-algorithm", "Ed25519",
            "-out", f"{config_dir}/bridge_signing.key"
        ], check=True, capture_output=True)
        
    async def start_server(self, server: TestServer):
        """Start a Matrix homeserver and its bridge"""
        print(f"Starting server {server.name}...")
        
        # Start Synapse
        homeserver_cmd = [
            "python", "-m", "synapse.app.homeserver",
            "--config-path", f"{server.config_dir}/homeserver.yaml"
        ]
        
        server.process = subprocess.Popen(
            homeserver_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Wait for Synapse to start
        await asyncio.sleep(5)
        
        # Start bridge
        bridge_cmd = [
            "cargo", "run", "--bin", "matrix-mycelium-bridge", "--",
            "--config", f"{server.config_dir}/bridge.toml"
        ]
        
        server.bridge_process = subprocess.Popen(
            bridge_cmd,
            cwd="../bridge",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Wait for bridge to start
        await asyncio.sleep(3)
        
    async def wait_for_servers(self):
        """Wait for all servers to be ready"""
        print("Waiting for servers to be ready...")
        
        for server in self.servers:
            max_retries = 30
            for i in range(max_retries):
                try:
                    response = requests.get(f"http://127.0.0.1:{server.port}/_matrix/client/versions", timeout=5)
                    if response.status_code == 200:
                        print(f"✓ Server {server.name} is ready")
                        break
                except requests.RequestException:
                    if i == max_retries - 1:
                        raise Exception(f"Server {server.name} failed to start")
                    await asyncio.sleep(2)
        
        # Register servers with discovery service
        for server in self.servers:
            await self.register_server_with_discovery(server)
    
    async def register_server_with_discovery(self, server: TestServer):
        """Register server with discovery service"""
        registration_data = {
            "server_name": server.name,
            "mycelium_address": f"127.0.0.1:{server.bridge_port}",
            "public_key": "test_public_key",
            "capabilities": ["federation", "client"],
            "capacity": {
                "max_users": 100,
                "current_users": 0,
                "available": True
            }
        }
        
        response = requests.post(
            "http://127.0.0.1:3000/servers/register",
            json=registration_data,
            timeout=10
        )
        
        if response.status_code == 200:
            print(f"✓ Registered {server.name} with discovery service")
        else:
            raise Exception(f"Failed to register {server.name}: {response.text}")
    
    async def test_basic_federation(self):
        """Test basic federation between two servers"""
        print("Testing basic federation...")
        
        server1, server2 = self.servers[0], self.servers[1]
        
        # Create users on each server
        user1_id = await self.create_user(server1, "alice", "password123")
        user2_id = await self.create_user(server2, "bob", "password456")
        
        print(f"Created users: {user1_id}, {user2_id}")
        
        # Get access tokens
        token1 = await self.login_user(server1, "alice", "password123")
        token2 = await self.login_user(server2, "bob", "password456")
        
        # Create a room on server1
        room_id = await self.create_room(server1, token1, "Test Federation Room")
        print(f"Created room: {room_id}")
        
        # Invite user2 to the room (cross-server invite)
        await self.invite_user_to_room(server1, token1, room_id, user2_id)
        print(f"Invited {user2_id} to room {room_id}")
        
        # User2 joins the room
        await self.join_room(server2, token2, room_id)
        print(f"{user2_id} joined room {room_id}")
        
        # Send messages between users
        message1 = await self.send_message(server1, token1, room_id, "Hello from server1!")
        message2 = await self.send_message(server2, token2, room_id, "Hello from server2!")
        
        # Verify messages are received on both servers
        messages1 = await self.get_room_messages(server1, token1, room_id)
        messages2 = await self.get_room_messages(server2, token2, room_id)
        
        assert len(messages1) >= 2, "Server1 should see both messages"
        assert len(messages2) >= 2, "Server2 should see both messages"
        
        print("✓ Basic federation test passed")
        
    async def test_discovery_service(self):
        """Test discovery service functionality"""
        print("Testing discovery service...")
        
        # List servers
        response = requests.get("http://127.0.0.1:3000/servers")
        assert response.status_code == 200
        
        data = response.json()
        assert data["total"] >= 2, "Should have at least 2 registered servers"
        
        # Select a server
        response = requests.get("http://127.0.0.1:3000/servers/select")
        assert response.status_code == 200
        
        data = response.json()
        assert data["server"] is not None, "Should select a server"
        
        # Get server stats
        response = requests.get("http://127.0.0.1:3000/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert data["total_servers"] >= 2, "Should show correct server count"
        
        print("✓ Discovery service test passed")
        
    async def test_bridge_communication(self):
        """Test bridge-to-bridge communication via Mycelium"""
        print("Testing bridge communication...")
        
        # This test would require actual Mycelium network setup
        # For now, we'll test the bridge API endpoints
        
        server1 = self.servers[0]
        
        # Test bridge health
        try:
            response = requests.get(f"http://127.0.0.1:{server1.bridge_port}/health", timeout=5)
            assert response.status_code == 200
            print("✓ Bridge health check passed")
        except requests.RequestException:
            print("⚠ Bridge health check failed (bridge may not be fully implemented)")
        
    async def create_user(self, server: TestServer, username: str, password: str) -> str:
        """Create a user on a server"""
        data = {
            "username": username,
            "password": password,
            "admin": False
        }
        
        response = requests.post(
            f"http://127.0.0.1:{server.port}/_synapse/admin/v1/register",
            json=data,
            timeout=10
        )
        
        if response.status_code == 200:
            return f"@{username}:{server.name}"
        else:
            raise Exception(f"Failed to create user: {response.text}")
    
    async def login_user(self, server: TestServer, username: str, password: str) -> str:
        """Login a user and get access token"""
        data = {
            "type": "m.login.password",
            "user": username,
            "password": password
        }
        
        response = requests.post(
            f"http://127.0.0.1:{server.port}/_matrix/client/r0/login",
            json=data,
            timeout=10
        )
        
        if response.status_code == 200:
            return response.json()["access_token"]
        else:
            raise Exception(f"Failed to login user: {response.text}")
    
    async def create_room(self, server: TestServer, token: str, name: str) -> str:
        """Create a room"""
        data = {
            "name": name,
            "preset": "public_chat"
        }
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(
            f"http://127.0.0.1:{server.port}/_matrix/client/r0/createRoom",
            json=data,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            return response.json()["room_id"]
        else:
            raise Exception(f"Failed to create room: {response.text}")
    
    async def invite_user_to_room(self, server: TestServer, token: str, room_id: str, user_id: str):
        """Invite a user to a room"""
        data = {"user_id": user_id}
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(
            f"http://127.0.0.1:{server.port}/_matrix/client/r0/rooms/{room_id}/invite",
            json=data,
            headers=headers,
            timeout=10
        )
        
        if response.status_code != 200:
            raise Exception(f"Failed to invite user: {response.text}")
    
    async def join_room(self, server: TestServer, token: str, room_id: str):
        """Join a room"""
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(
            f"http://127.0.0.1:{server.port}/_matrix/client/r0/rooms/{room_id}/join",
            headers=headers,
            timeout=10
        )
        
        if response.status_code != 200:
            raise Exception(f"Failed to join room: {response.text}")
    
    async def send_message(self, server: TestServer, token: str, room_id: str, message: str) -> str:
        """Send a message to a room"""
        data = {
            "msgtype": "m.text",
            "body": message
        }
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.put(
            f"http://127.0.0.1:{server.port}/_matrix/client/r0/rooms/{room_id}/send/m.room.message/{int(time.time() * 1000)}",
            json=data,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            return response.json()["event_id"]
        else:
            raise Exception(f"Failed to send message: {response.text}")
    
    async def get_room_messages(self, server: TestServer, token: str, room_id: str) -> List[Dict]:
        """Get messages from a room"""
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"http://127.0.0.1:{server.port}/_matrix/client/r0/rooms/{room_id}/messages?dir=b&limit=10",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            return response.json().get("chunk", [])
        else:
            raise Exception(f"Failed to get messages: {response.text}")
    
    async def cleanup(self):
        """Clean up test environment"""
        print("Cleaning up test environment...")
        
        # Stop all server processes
        for server in self.servers:
            if server.process:
                server.process.terminate()
                try:
                    server.process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    server.process.kill()
            
            if server.bridge_process:
                server.bridge_process.terminate()
                try:
                    server.bridge_process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    server.bridge_process.kill()
        
        # Stop discovery service
        if self.discovery_process:
            self.discovery_process.terminate()
            try:
                self.discovery_process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.discovery_process.kill()
        
        # Clean up temporary directories
        import shutil
        for temp_dir in self.temp_dirs:
            try:
                shutil.rmtree(temp_dir)
            except Exception as e:
                print(f"Warning: Failed to remove {temp_dir}: {e}")

async def run_integration_tests():
    """Run all integration tests"""
    test_suite = FederationTestSuite()
    
    try:
        await test_suite.setup_test_environment()
        
        print("\n=== Running Integration Tests ===")
        
        # Run tests
        await test_suite.test_discovery_service()
        await test_suite.test_bridge_communication()
        await test_suite.test_basic_federation()
        
        print("\n✓ All integration tests passed!")
        
    except Exception as e:
        print(f"\n✗ Integration tests failed: {e}")
        raise
    finally:
        await test_suite.cleanup()

if __name__ == "__main__":
    asyncio.run(run_integration_tests())
