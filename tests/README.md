# Mycelium Chat Testing Suite

Comprehensive testing framework for the Matrix-Mycelium federation system.

## Test Structure

```
tests/
├── integration/           # Integration tests
│   ├── test_federation.py    # Core federation testing
│   ├── test_performance.py   # Performance and load testing
│   ├── test_security.py      # Security vulnerability testing
│   └── test_runner.sh        # Test execution script
└── README.md             # This file
```

## Quick Start

### Run All Tests
```bash
cd tests/integration
chmod +x test_runner.sh
./test_runner.sh
```

### Run Specific Test Types
```bash
# Unit tests only
./test_runner.sh --unit-only

# Integration tests only
./test_runner.sh --integration-only

# All tests including performance and security
./test_runner.sh --all

# Performance tests
./test_runner.sh --performance

# Security tests
./test_runner.sh --security
```

## Test Categories

### 1. Integration Tests (`test_federation.py`)

Tests the complete federation flow between multiple homeservers:

- **Multi-server setup**: Automatically configures and starts multiple Matrix homeservers with bridges
- **Discovery service**: Tests server registration, selection, and load balancing
- **Cross-server federation**: User creation, room creation, invites, and messaging across servers
- **Bridge communication**: Tests Matrix-Mycelium bridge functionality

**Key Features:**
- Automatic test environment setup and cleanup
- Temporary configuration generation
- Process management for multiple services
- Comprehensive federation flow validation

### 2. Performance Tests (`test_performance.py`)

Evaluates system performance under various load conditions:

- **Discovery service throughput**: Measures requests per second and latency
- **Message federation latency**: Tests message delivery speed across servers
- **Concurrent user load**: Simulates multiple users performing activities
- **Memory usage monitoring**: Tracks memory consumption over time

**Metrics Collected:**
- Throughput (requests/messages per second)
- Latency (average, P95, P99)
- Success rate and error counts
- Memory usage patterns

**Output:**
- HTML performance report with charts
- Recommendations for optimization
- Performance visualizations

### 3. Security Tests (`test_security.py`)

Comprehensive security vulnerability assessment:

- **Authentication bypass**: Tests for unauthorized access
- **Injection attacks**: SQL injection and other injection vulnerabilities
- **Rate limiting**: Validates DoS protection mechanisms
- **TLS configuration**: Checks encryption and certificate setup
- **Input validation**: Tests handling of malicious inputs
- **Secrets management**: Scans for hardcoded credentials
- **CORS configuration**: Validates cross-origin policies
- **Information disclosure**: Tests for sensitive data leaks

**Security Score:**
- Calculates overall security score (0-100%)
- Categorizes issues by severity (Critical, High, Medium, Low)
- Provides actionable remediation recommendations

## Prerequisites

### System Requirements
- **Rust**: Latest stable version with Cargo
- **Python 3.8+**: With pip and venv support
- **PostgreSQL**: Optional, SQLite used as fallback
- **Git**: For repository operations

### Python Dependencies
```bash
pip install pytest pytest-asyncio requests websockets matrix-synapse
pip install matplotlib numpy psutil  # For performance tests
pip install cryptography pyjwt      # For security tests
```

### Rust Dependencies
All Rust dependencies are managed via `Cargo.toml` files in respective components.

## Test Configuration

### Environment Variables
```bash
export RUST_LOG=debug                    # Rust logging level
export PYTHONPATH="$PROJECT_ROOT/auth-provider:$PYTHONPATH"
```

### Test Settings
- **Discovery service**: Runs on port 3000
- **Matrix servers**: Ports 8008, 8009 (configurable)
- **Bridge services**: Ports 8080, 8081 (configurable)
- **Test duration**: Configurable per test type
- **Concurrency levels**: Adjustable for load testing

## Output and Reporting

### Log Files
All test execution logs are saved to `test-logs/`:
- `rust-unit-tests.log`
- `python-unit-tests.log`
- `federation-tests.log`
- `performance-tests.log`
- `security-tests.log`

### Reports
- **Test Report**: `test-logs/test-report.html`
- **Performance Report**: `performance_report.html`
- **Security Report**: `security_report.html`

### Charts and Visualizations
Performance tests generate charts:
- `throughput_chart.png`
- `latency_chart.png`

## Continuous Integration

### GitHub Actions Integration
```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Tests
        run: |
          cd tests/integration
          ./test_runner.sh --all
```

### Test Automation
- Automatic environment setup and cleanup
- Parallel test execution where possible
- Comprehensive error handling and reporting
- Integration with CI/CD pipelines

## Development Guidelines

### Adding New Tests

1. **Integration Tests**: Add to `test_federation.py`
   ```python
   async def test_new_feature(self):
       """Test description"""
       # Test implementation
       assert condition, "Failure message"
   ```

2. **Performance Tests**: Add to `test_performance.py`
   ```python
   async def test_new_performance_metric(self):
       """Performance test description"""
       # Measure performance
       # Record metrics
   ```

3. **Security Tests**: Add to `test_security.py`
   ```python
   async def test_new_security_check(self):
       """Security test description"""
       # Security validation
       # Record results
   ```

### Test Best Practices

- **Isolation**: Each test should be independent
- **Cleanup**: Always clean up resources after tests
- **Assertions**: Use descriptive assertion messages
- **Documentation**: Document test purpose and expected behavior
- **Error Handling**: Handle exceptions gracefully
- **Performance**: Optimize test execution time

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check for running services
   netstat -tulpn | grep :8008
   # Kill conflicting processes
   pkill -f synapse
   ```

2. **Permission Errors**
   ```bash
   # Make scripts executable
   chmod +x test_runner.sh
   # Fix Python virtual environment
   python3 -m venv test-venv --clear
   ```

3. **Dependency Issues**
   ```bash
   # Update Rust toolchain
   rustup update
   # Reinstall Python dependencies
   pip install --upgrade --force-reinstall -r requirements.txt
   ```

4. **Test Failures**
   - Check log files in `test-logs/`
   - Verify all services are running
   - Ensure network connectivity
   - Check configuration files

### Debug Mode
```bash
# Enable verbose logging
export RUST_LOG=trace
export PYTHONPATH="$PROJECT_ROOT/auth-provider:$PYTHONPATH"

# Run individual tests
python test_federation.py
python test_performance.py
python test_security.py
```

## Contributing

1. **Fork** the repository
2. **Create** a feature branch
3. **Add** comprehensive tests for new features
4. **Run** the full test suite
5. **Submit** a pull request with test results

### Test Coverage Goals
- **Unit Tests**: >90% code coverage
- **Integration Tests**: All major user flows
- **Performance Tests**: All critical paths
- **Security Tests**: OWASP Top 10 coverage

## Support

For test-related issues:
1. Check the troubleshooting section
2. Review log files for detailed error information
3. Consult the main project documentation
4. Open an issue with test logs and environment details
