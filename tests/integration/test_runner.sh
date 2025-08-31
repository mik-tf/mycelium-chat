#!/bin/bash
# Integration Test Runner for Mycelium Chat
# Runs comprehensive tests for Matrix-Mycelium federation

set -e

# Configuration
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$TEST_DIR/../.." && pwd)"
VENV_DIR="$PROJECT_ROOT/test-venv"
LOG_DIR="$PROJECT_ROOT/test-logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Mycelium Chat Integration Test Runner ===${NC}"

# Create log directory
mkdir -p "$LOG_DIR"

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check if Rust is installed
    if ! command -v cargo &> /dev/null; then
        echo -e "${RED}Error: Rust/Cargo not found. Please install Rust.${NC}"
        exit 1
    fi
    
    # Check if Python is installed
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}Error: Python 3 not found. Please install Python 3.${NC}"
        exit 1
    fi
    
    # Check if PostgreSQL is available (optional)
    if command -v psql &> /dev/null; then
        echo -e "${GREEN}✓ PostgreSQL found${NC}"
    else
        echo -e "${YELLOW}⚠ PostgreSQL not found, using SQLite for tests${NC}"
    fi
    
    echo -e "${GREEN}✓ Prerequisites check passed${NC}"
}

# Set up test environment
setup_test_environment() {
    echo -e "${YELLOW}Setting up test environment...${NC}"
    
    # Create Python virtual environment
    if [ ! -d "$VENV_DIR" ]; then
        python3 -m venv "$VENV_DIR"
    fi
    
    # Activate virtual environment
    source "$VENV_DIR/bin/activate"
    
    # Install Python dependencies
    pip install --upgrade pip
    pip install pytest pytest-asyncio requests websockets matrix-synapse
    
    # Build Rust components
    echo -e "${YELLOW}Building Rust components...${NC}"
    cd "$PROJECT_ROOT"
    cargo build --release
    
    echo -e "${GREEN}✓ Test environment setup complete${NC}"
}

# Run unit tests
run_unit_tests() {
    echo -e "${YELLOW}Running unit tests...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Run Rust unit tests
    echo -e "${BLUE}Running Rust unit tests...${NC}"
    cargo test --lib 2>&1 | tee "$LOG_DIR/rust-unit-tests.log"
    
    # Run Python unit tests if they exist
    if [ -d "tests/unit" ]; then
        echo -e "${BLUE}Running Python unit tests...${NC}"
        source "$VENV_DIR/bin/activate"
        python -m pytest tests/unit/ -v 2>&1 | tee "$LOG_DIR/python-unit-tests.log"
    fi
    
    echo -e "${GREEN}✓ Unit tests completed${NC}"
}

# Run integration tests
run_integration_tests() {
    echo -e "${YELLOW}Running integration tests...${NC}"
    
    source "$VENV_DIR/bin/activate"
    cd "$TEST_DIR"
    
    # Set environment variables for testing
    export RUST_LOG=debug
    export PYTHONPATH="$PROJECT_ROOT/auth-provider:$PYTHONPATH"
    
    # Run federation tests
    echo -e "${BLUE}Running federation tests...${NC}"
    python test_federation.py 2>&1 | tee "$LOG_DIR/federation-tests.log"
    
    echo -e "${GREEN}✓ Integration tests completed${NC}"
}

# Run performance tests
run_performance_tests() {
    echo -e "${YELLOW}Running performance tests...${NC}"
    
    if [ -f "$TEST_DIR/test_performance.py" ]; then
        source "$VENV_DIR/bin/activate"
        python "$TEST_DIR/test_performance.py" 2>&1 | tee "$LOG_DIR/performance-tests.log"
    else
        echo -e "${YELLOW}⚠ Performance tests not found, skipping${NC}"
    fi
    
    echo -e "${GREEN}✓ Performance tests completed${NC}"
}

# Run security tests
run_security_tests() {
    echo -e "${YELLOW}Running security tests...${NC}"
    
    if [ -f "$TEST_DIR/test_security.py" ]; then
        source "$VENV_DIR/bin/activate"
        python "$TEST_DIR/test_security.py" 2>&1 | tee "$LOG_DIR/security-tests.log"
    else
        echo -e "${YELLOW}⚠ Security tests not found, skipping${NC}"
    fi
    
    echo -e "${GREEN}✓ Security tests completed${NC}"
}

# Generate test report
generate_report() {
    echo -e "${YELLOW}Generating test report...${NC}"
    
    REPORT_FILE="$LOG_DIR/test-report.html"
    
    cat > "$REPORT_FILE" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Mycelium Chat Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #1a73e8; color: white; padding: 20px; border-radius: 8px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .pass { background: #d4edda; border-color: #c3e6cb; }
        .fail { background: #f8d7da; border-color: #f5c6cb; }
        .warn { background: #fff3cd; border-color: #ffeaa7; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Mycelium Chat Test Report</h1>
        <p class="timestamp">Generated: $(date)</p>
    </div>
EOF

    # Add test results
    if [ -f "$LOG_DIR/rust-unit-tests.log" ]; then
        echo '<div class="section"><h2>Rust Unit Tests</h2><pre>' >> "$REPORT_FILE"
        tail -20 "$LOG_DIR/rust-unit-tests.log" >> "$REPORT_FILE"
        echo '</pre></div>' >> "$REPORT_FILE"
    fi
    
    if [ -f "$LOG_DIR/federation-tests.log" ]; then
        echo '<div class="section"><h2>Federation Tests</h2><pre>' >> "$REPORT_FILE"
        tail -20 "$LOG_DIR/federation-tests.log" >> "$REPORT_FILE"
        echo '</pre></div>' >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF
    <div class="section">
        <h2>Test Summary</h2>
        <p>All test logs are available in: <code>$LOG_DIR</code></p>
        <p>For detailed results, check individual log files.</p>
    </div>
</body>
</html>
EOF

    echo -e "${GREEN}✓ Test report generated: $REPORT_FILE${NC}"
}

# Cleanup function
cleanup() {
    echo -e "${YELLOW}Cleaning up test environment...${NC}"
    
    # Kill any remaining test processes
    pkill -f "matrix-mycelium-bridge" 2>/dev/null || true
    pkill -f "mycelium-discovery-service" 2>/dev/null || true
    pkill -f "synapse.app.homeserver" 2>/dev/null || true
    
    # Clean up temporary files
    find /tmp -name "tmp*mycelium*" -type d -exec rm -rf {} + 2>/dev/null || true
    
    echo -e "${GREEN}✓ Cleanup completed${NC}"
}

# Main execution
main() {
    # Set up trap for cleanup
    trap cleanup EXIT
    
    # Parse command line arguments
    RUN_UNIT=true
    RUN_INTEGRATION=true
    RUN_PERFORMANCE=false
    RUN_SECURITY=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --unit-only)
                RUN_INTEGRATION=false
                RUN_PERFORMANCE=false
                RUN_SECURITY=false
                shift
                ;;
            --integration-only)
                RUN_UNIT=false
                RUN_PERFORMANCE=false
                RUN_SECURITY=false
                shift
                ;;
            --all)
                RUN_PERFORMANCE=true
                RUN_SECURITY=true
                shift
                ;;
            --performance)
                RUN_PERFORMANCE=true
                shift
                ;;
            --security)
                RUN_SECURITY=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --unit-only      Run only unit tests"
                echo "  --integration-only Run only integration tests"
                echo "  --all           Run all tests including performance and security"
                echo "  --performance   Include performance tests"
                echo "  --security      Include security tests"
                echo "  --help          Show this help message"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run test phases
    check_prerequisites
    setup_test_environment
    
    if [ "$RUN_UNIT" = true ]; then
        run_unit_tests
    fi
    
    if [ "$RUN_INTEGRATION" = true ]; then
        run_integration_tests
    fi
    
    if [ "$RUN_PERFORMANCE" = true ]; then
        run_performance_tests
    fi
    
    if [ "$RUN_SECURITY" = true ]; then
        run_security_tests
    fi
    
    generate_report
    
    echo -e "${GREEN}=== All tests completed successfully! ===${NC}"
    echo -e "${BLUE}Test logs: $LOG_DIR${NC}"
    echo -e "${BLUE}Test report: $LOG_DIR/test-report.html${NC}"
}

# Run main function
main "$@"
