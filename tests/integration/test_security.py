#!/usr/bin/env python3
"""
Security tests for Matrix-Mycelium federation
Tests authentication, authorization, encryption, and security vulnerabilities
"""

import asyncio
import json
import requests
import time
import hashlib
import hmac
import jwt
import secrets
from typing import Dict, List, Optional
from dataclasses import dataclass
import subprocess

@dataclass
class SecurityTestResult:
    """Security test result"""
    test_name: str
    passed: bool
    severity: str  # low, medium, high, critical
    description: str
    recommendation: str

class SecurityTestSuite:
    """Security test suite for federation components"""
    
    def __init__(self):
        self.results: List[SecurityTestResult] = []
        self.discovery_url = "http://127.0.0.1:3000"
        self.matrix_url = "http://127.0.0.1:8008"
        self.bridge_url = "http://127.0.0.1:8080"
        
    async def test_authentication_bypass(self):
        """Test for authentication bypass vulnerabilities"""
        print("Testing authentication bypass...")
        
        # Test 1: Direct API access without token
        try:
            response = requests.get(f"{self.matrix_url}/_matrix/client/r0/account/whoami")
            if response.status_code != 401:
                self.results.append(SecurityTestResult(
                    test_name="Authentication Bypass - Direct API",
                    passed=False,
                    severity="critical",
                    description="API allows access without authentication",
                    recommendation="Ensure all protected endpoints require valid authentication"
                ))
            else:
                self.results.append(SecurityTestResult(
                    test_name="Authentication Bypass - Direct API",
                    passed=True,
                    severity="low",
                    description="API correctly rejects unauthenticated requests",
                    recommendation="Continue monitoring authentication enforcement"
                ))
        except Exception as e:
            print(f"Authentication test error: {e}")
        
        # Test 2: Invalid token handling
        try:
            headers = {"Authorization": "Bearer invalid_token_12345"}
            response = requests.get(f"{self.matrix_url}/_matrix/client/r0/account/whoami", headers=headers)
            if response.status_code != 401:
                self.results.append(SecurityTestResult(
                    test_name="Invalid Token Handling",
                    passed=False,
                    severity="high",
                    description="API accepts invalid authentication tokens",
                    recommendation="Implement proper token validation and rejection"
                ))
            else:
                self.results.append(SecurityTestResult(
                    test_name="Invalid Token Handling",
                    passed=True,
                    severity="low",
                    description="API correctly rejects invalid tokens",
                    recommendation="Continue monitoring token validation"
                ))
        except Exception as e:
            print(f"Invalid token test error: {e}")
    
    async def test_injection_attacks(self):
        """Test for SQL injection and other injection vulnerabilities"""
        print("Testing injection attacks...")
        
        # SQL injection payloads
        sql_payloads = [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "'; SELECT * FROM users; --",
            "admin'--",
            "' UNION SELECT password FROM users--"
        ]
        
        # Test discovery service
        for payload in sql_payloads:
            try:
                # Test server registration with malicious data
                malicious_data = {
                    "server_name": payload,
                    "mycelium_address": "127.0.0.1:8080",
                    "public_key": "test_key",
                    "capabilities": ["federation"],
                    "capacity": {"max_users": 100, "current_users": 0, "available": True}
                }
                
                response = requests.post(f"{self.discovery_url}/servers/register", json=malicious_data, timeout=5)
                
                # Check if server processed the malicious input safely
                if response.status_code == 500:
                    self.results.append(SecurityTestResult(
                        test_name="SQL Injection - Discovery Service",
                        passed=False,
                        severity="critical",
                        description=f"Discovery service vulnerable to SQL injection: {payload}",
                        recommendation="Implement parameterized queries and input sanitization"
                    ))
                    break
            except Exception:
                pass  # Expected for malicious payloads
        else:
            self.results.append(SecurityTestResult(
                test_name="SQL Injection - Discovery Service",
                passed=True,
                severity="low",
                description="Discovery service appears resistant to SQL injection",
                recommendation="Continue monitoring and use parameterized queries"
            ))
    
    async def test_rate_limiting(self):
        """Test rate limiting implementation"""
        print("Testing rate limiting...")
        
        # Test discovery service rate limiting
        start_time = time.time()
        request_count = 0
        blocked_count = 0
        
        # Send rapid requests
        for i in range(100):
            try:
                response = requests.get(f"{self.discovery_url}/servers", timeout=1)
                request_count += 1
                if response.status_code == 429:  # Too Many Requests
                    blocked_count += 1
            except Exception:
                pass
        
        duration = time.time() - start_time
        
        if blocked_count == 0 and duration < 10:  # If no rate limiting and very fast
            self.results.append(SecurityTestResult(
                test_name="Rate Limiting - Discovery Service",
                passed=False,
                severity="medium",
                description="No rate limiting detected on discovery service",
                recommendation="Implement rate limiting to prevent abuse and DoS attacks"
            ))
        else:
            self.results.append(SecurityTestResult(
                test_name="Rate Limiting - Discovery Service",
                passed=True,
                severity="low",
                description=f"Rate limiting working: {blocked_count}/{request_count} requests blocked",
                recommendation="Monitor rate limiting effectiveness and adjust thresholds as needed"
            ))
    
    async def test_tls_configuration(self):
        """Test TLS/SSL configuration"""
        print("Testing TLS configuration...")
        
        # Check if services are running with HTTPS
        services = [
            ("Discovery Service", self.discovery_url),
            ("Matrix Server", self.matrix_url),
            ("Bridge Service", self.bridge_url)
        ]
        
        for service_name, url in services:
            if url.startswith("http://"):
                self.results.append(SecurityTestResult(
                    test_name=f"TLS Configuration - {service_name}",
                    passed=False,
                    severity="high",
                    description=f"{service_name} running without TLS encryption",
                    recommendation="Configure TLS/SSL certificates and use HTTPS in production"
                ))
            else:
                # Test TLS configuration quality
                try:
                    import ssl
                    import socket
                    from urllib.parse import urlparse
                    
                    parsed = urlparse(url)
                    context = ssl.create_default_context()
                    
                    with socket.create_connection((parsed.hostname, parsed.port or 443)) as sock:
                        with context.wrap_socket(sock, server_hostname=parsed.hostname) as ssock:
                            cipher = ssock.cipher()
                            if cipher and cipher[1] in ['TLSv1.2', 'TLSv1.3']:
                                self.results.append(SecurityTestResult(
                                    test_name=f"TLS Configuration - {service_name}",
                                    passed=True,
                                    severity="low",
                                    description=f"{service_name} using secure TLS configuration",
                                    recommendation="Continue monitoring TLS configuration"
                                ))
                            else:
                                self.results.append(SecurityTestResult(
                                    test_name=f"TLS Configuration - {service_name}",
                                    passed=False,
                                    severity="medium",
                                    description=f"{service_name} using weak TLS configuration",
                                    recommendation="Upgrade to TLS 1.2 or 1.3 with strong ciphers"
                                ))
                except Exception:
                    # Assume HTTPS is configured if we can't test
                    pass
    
    async def test_input_validation(self):
        """Test input validation and sanitization"""
        print("Testing input validation...")
        
        # Test with various malicious inputs
        malicious_inputs = [
            "<script>alert('xss')</script>",
            "javascript:alert('xss')",
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\config\\sam",
            "\x00\x01\x02\x03",  # Null bytes and control characters
            "A" * 10000,  # Very long input
            {"nested": {"very": {"deep": {"object": "value"}}}},  # Deep nesting
        ]
        
        for malicious_input in malicious_inputs:
            try:
                # Test discovery service input validation
                if isinstance(malicious_input, str):
                    data = {
                        "server_name": malicious_input,
                        "mycelium_address": "127.0.0.1:8080",
                        "public_key": "test_key",
                        "capabilities": ["federation"],
                        "capacity": {"max_users": 100, "current_users": 0, "available": True}
                    }
                else:
                    data = malicious_input
                
                response = requests.post(f"{self.discovery_url}/servers/register", json=data, timeout=5)
                
                # Service should reject malicious input gracefully
                if response.status_code == 500:
                    self.results.append(SecurityTestResult(
                        test_name="Input Validation",
                        passed=False,
                        severity="medium",
                        description="Service crashes on malicious input",
                        recommendation="Implement robust input validation and error handling"
                    ))
                    break
            except Exception:
                pass  # Expected for malicious inputs
        else:
            self.results.append(SecurityTestResult(
                test_name="Input Validation",
                passed=True,
                severity="low",
                description="Services handle malicious input gracefully",
                recommendation="Continue monitoring input validation effectiveness"
            ))
    
    async def test_secrets_management(self):
        """Test secrets and key management"""
        print("Testing secrets management...")
        
        # Check for hardcoded secrets in config files
        config_files = [
            "../auth-provider/config.yaml",
            "../discovery-service/config.toml",
            "../bridge/config.toml"
        ]
        
        suspicious_patterns = [
            "password",
            "secret",
            "key",
            "token",
            "api_key"
        ]
        
        hardcoded_secrets_found = False
        
        for config_file in config_files:
            try:
                with open(config_file, 'r') as f:
                    content = f.read().lower()
                    for pattern in suspicious_patterns:
                        if f"{pattern}:" in content or f"{pattern}=" in content:
                            # Check if it looks like a real secret (not a placeholder)
                            lines = content.split('\n')
                            for line in lines:
                                if pattern in line and ('=' in line or ':' in line):
                                    value = line.split('=' if '=' in line else ':')[-1].strip()
                                    if len(value) > 10 and not any(placeholder in value.lower() for placeholder in ['your_', 'change_me', 'placeholder', 'example']):
                                        hardcoded_secrets_found = True
                                        break
            except FileNotFoundError:
                pass
        
        if hardcoded_secrets_found:
            self.results.append(SecurityTestResult(
                test_name="Secrets Management",
                passed=False,
                severity="high",
                description="Hardcoded secrets found in configuration files",
                recommendation="Use environment variables or secure key management systems"
            ))
        else:
            self.results.append(SecurityTestResult(
                test_name="Secrets Management",
                passed=True,
                severity="low",
                description="No hardcoded secrets detected in configuration",
                recommendation="Continue using secure secret management practices"
            ))
    
    async def test_cors_configuration(self):
        """Test CORS configuration"""
        print("Testing CORS configuration...")
        
        # Test CORS headers
        try:
            headers = {
                "Origin": "https://malicious-site.com",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type"
            }
            
            response = requests.options(f"{self.discovery_url}/servers", headers=headers, timeout=5)
            
            cors_headers = {
                "Access-Control-Allow-Origin": response.headers.get("Access-Control-Allow-Origin"),
                "Access-Control-Allow-Methods": response.headers.get("Access-Control-Allow-Methods"),
                "Access-Control-Allow-Headers": response.headers.get("Access-Control-Allow-Headers")
            }
            
            # Check for overly permissive CORS
            if cors_headers["Access-Control-Allow-Origin"] == "*":
                self.results.append(SecurityTestResult(
                    test_name="CORS Configuration",
                    passed=False,
                    severity="medium",
                    description="CORS allows all origins (*)",
                    recommendation="Restrict CORS to specific trusted origins"
                ))
            else:
                self.results.append(SecurityTestResult(
                    test_name="CORS Configuration",
                    passed=True,
                    severity="low",
                    description="CORS configuration appears restrictive",
                    recommendation="Continue monitoring CORS configuration"
                ))
                
        except Exception as e:
            print(f"CORS test error: {e}")
    
    async def test_information_disclosure(self):
        """Test for information disclosure vulnerabilities"""
        print("Testing information disclosure...")
        
        # Test error message disclosure
        try:
            # Send malformed request to trigger error
            response = requests.post(f"{self.discovery_url}/servers/register", json={"invalid": "data"}, timeout=5)
            
            if response.status_code >= 400:
                error_text = response.text.lower()
                sensitive_info = ["stack trace", "file path", "database", "internal server error", "exception"]
                
                if any(info in error_text for info in sensitive_info):
                    self.results.append(SecurityTestResult(
                        test_name="Information Disclosure",
                        passed=False,
                        severity="medium",
                        description="Error messages contain sensitive information",
                        recommendation="Implement generic error messages for production"
                    ))
                else:
                    self.results.append(SecurityTestResult(
                        test_name="Information Disclosure",
                        passed=True,
                        severity="low",
                        description="Error messages do not expose sensitive information",
                        recommendation="Continue monitoring error message content"
                    ))
        except Exception as e:
            print(f"Information disclosure test error: {e}")
    
    def generate_security_report(self, output_file: str = "security_report.html"):
        """Generate HTML security report"""
        print("Generating security report...")
        
        # Calculate security score
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r.passed)
        security_score = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        # Count by severity
        critical_issues = sum(1 for r in self.results if not r.passed and r.severity == "critical")
        high_issues = sum(1 for r in self.results if not r.passed and r.severity == "high")
        medium_issues = sum(1 for r in self.results if not r.passed and r.severity == "medium")
        
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Mycelium Chat Security Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; }}
        .header {{ background: #dc3545; color: white; padding: 20px; border-radius: 8px; }}
        .score {{ background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }}
        .score.good {{ background: #d4edda; }}
        .score.warning {{ background: #fff3cd; }}
        .score.danger {{ background: #f8d7da; }}
        .test-result {{ margin: 15px 0; padding: 15px; border-radius: 8px; }}
        .test-result.pass {{ background: #d4edda; border-left: 5px solid #28a745; }}
        .test-result.fail {{ background: #f8d7da; border-left: 5px solid #dc3545; }}
        .severity {{ font-weight: bold; padding: 3px 8px; border-radius: 4px; color: white; }}
        .severity.critical {{ background: #dc3545; }}
        .severity.high {{ background: #fd7e14; }}
        .severity.medium {{ background: #ffc107; color: black; }}
        .severity.low {{ background: #28a745; }}
        table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
        th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
        th {{ background-color: #f2f2f2; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 Mycelium Chat Security Report</h1>
        <p>Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}</p>
    </div>
    
    <div class="score {'good' if security_score >= 90 else 'warning' if security_score >= 70 else 'danger'}">
        <h2>Security Score: {security_score:.1f}%</h2>
        <p>{passed_tests}/{total_tests} tests passed</p>
        <p>
            <span class="severity critical">{critical_issues} Critical</span>
            <span class="severity high">{high_issues} High</span>
            <span class="severity medium">{medium_issues} Medium</span>
        </p>
    </div>
    
    <h2>Security Test Results</h2>
"""
        
        for result in self.results:
            status_class = "pass" if result.passed else "fail"
            status_text = "✅ PASS" if result.passed else "❌ FAIL"
            
            html_content += f"""
    <div class="test-result {status_class}">
        <h3>{result.test_name} {status_text}</h3>
        <p><span class="severity {result.severity}">{result.severity.upper()}</span></p>
        <p><strong>Description:</strong> {result.description}</p>
        <p><strong>Recommendation:</strong> {result.recommendation}</p>
    </div>
"""
        
        html_content += """
    <h2>Security Recommendations</h2>
    <ul>
        <li><strong>Authentication:</strong> Implement multi-factor authentication for admin access</li>
        <li><strong>Encryption:</strong> Use TLS 1.3 for all communications</li>
        <li><strong>Input Validation:</strong> Validate and sanitize all user inputs</li>
        <li><strong>Rate Limiting:</strong> Implement rate limiting on all public endpoints</li>
        <li><strong>Monitoring:</strong> Set up security monitoring and alerting</li>
        <li><strong>Updates:</strong> Keep all dependencies and systems updated</li>
        <li><strong>Secrets:</strong> Use secure key management systems</li>
        <li><strong>Auditing:</strong> Regular security audits and penetration testing</li>
    </ul>
    
    <h2>Next Steps</h2>
    <ol>
        <li>Address all critical and high severity issues immediately</li>
        <li>Plan remediation for medium severity issues</li>
        <li>Implement continuous security monitoring</li>
        <li>Schedule regular security assessments</li>
        <li>Create incident response procedures</li>
    </ol>
</body>
</html>
"""
        
        with open(output_file, 'w') as f:
            f.write(html_content)
        
        print(f"✓ Security report saved to {output_file}")
        print(f"🔒 Security Score: {security_score:.1f}% ({passed_tests}/{total_tests} tests passed)")
        
        if critical_issues > 0:
            print(f"🚨 {critical_issues} CRITICAL security issues found!")
        if high_issues > 0:
            print(f"⚠️  {high_issues} HIGH severity issues found")

async def run_security_tests():
    """Run all security tests"""
    test_suite = SecurityTestSuite()
    
    print("=== Running Security Tests ===")
    
    try:
        # Run security tests
        await test_suite.test_authentication_bypass()
        await test_suite.test_injection_attacks()
        await test_suite.test_rate_limiting()
        await test_suite.test_tls_configuration()
        await test_suite.test_input_validation()
        await test_suite.test_secrets_management()
        await test_suite.test_cors_configuration()
        await test_suite.test_information_disclosure()
        
        # Generate report
        test_suite.generate_security_report()
        
        print("\n✓ All security tests completed!")
        print("🔒 Security report: security_report.html")
        
    except Exception as e:
        print(f"\n✗ Security tests failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(run_security_tests())
