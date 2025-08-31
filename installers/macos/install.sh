#!/bin/bash
# Mycelium Chat macOS Installer
# Bash script to install Matrix homeserver + Mycelium bridge on macOS

set -e

# Configuration
INSTALL_DIR="/usr/local/mycelium-chat"
CONFIG_DIR="/usr/local/etc/mycelium-chat"
LOG_DIR="/usr/local/var/log/mycelium-chat"
DATA_DIR="/usr/local/var/lib/mycelium-chat"
USER="_mycelium-chat"
SILENT=false
DEV_MODE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --install-dir)
            INSTALL_DIR="$2"
            shift 2
            ;;
        --silent)
            SILENT=true
            shift
            ;;
        --dev-mode)
            DEV_MODE=true
            shift
            ;;
        --help)
            echo "Mycelium Chat macOS Installer"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --install-dir DIR    Installation directory (default: /usr/local/mycelium-chat)"
            echo "  --silent            Silent installation"
            echo "  --dev-mode          Enable development mode"
            echo "  --help              Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    echo "Error: This installer should not be run as root. Run as a regular user with sudo access."
    exit 1
fi

echo "=== Mycelium Chat macOS Installer ==="
echo "Installing to: $INSTALL_DIR"

# Install Homebrew if not present
install_homebrew() {
    if ! command -v brew &> /dev/null; then
        echo "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Add Homebrew to PATH for Apple Silicon Macs
        if [[ $(uname -m) == "arm64" ]]; then
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
    fi
}

# Install dependencies
install_dependencies() {
    echo "Installing dependencies..."
    
    # Update Homebrew
    brew update
    
    # Install required packages
    brew install git python@3.11 postgresql@14 redis nginx curl wget openssl libffi
    
    # Install Rust
    if ! command -v cargo &> /dev/null; then
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source ~/.cargo/env
    fi
    
    # Install Node.js
    if ! command -v node &> /dev/null; then
        brew install node@18
    fi
    
    # Start PostgreSQL and Redis
    brew services start postgresql@14
    brew services start redis
}

# Create system user
create_user() {
    echo "Creating system user..."
    
    # Check if user exists
    if ! dscl . -read /Users/$USER &>/dev/null; then
        # Find next available UID starting from 200
        local uid=200
        while dscl . -read /Users/_user$uid &>/dev/null; do
            ((uid++))
        done
        
        # Create user
        sudo dscl . -create /Users/$USER
        sudo dscl . -create /Users/$USER UserShell /usr/bin/false
        sudo dscl . -create /Users/$USER RealName "Mycelium Chat Service"
        sudo dscl . -create /Users/$USER UniqueID $uid
        sudo dscl . -create /Users/$USER PrimaryGroupID 20
        sudo dscl . -create /Users/$USER NFSHomeDirectory "$DATA_DIR"
        sudo dscl . -passwd /Users/$USER '*'
    fi
}

# Create directories
create_directories() {
    echo "Creating directories..."
    sudo mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" "$LOG_DIR" "$DATA_DIR"
    sudo chown -R "$USER:staff" "$INSTALL_DIR" "$LOG_DIR" "$DATA_DIR"
    sudo chmod 755 "$CONFIG_DIR"
}

# Download and build Mycelium Chat
install_mycelium_chat() {
    echo "Downloading Mycelium Chat..."
    
    cd "$INSTALL_DIR"
    if [ -d "mycelium-chat" ]; then
        sudo rm -rf mycelium-chat
    fi
    
    sudo git clone https://github.com/threefoldtech/mycelium-chat.git
    cd mycelium-chat
    
    echo "Building Rust components..."
    cargo build --release
    
    # Copy binaries
    sudo cp target/release/matrix-mycelium-bridge "$INSTALL_DIR/"
    sudo cp target/release/mycelium-discovery-service "$INSTALL_DIR/"
    
    # Install Python dependencies
    echo "Installing Python dependencies..."
    sudo python3 -m venv "$INSTALL_DIR/venv"
    sudo "$INSTALL_DIR/venv/bin/pip" install --upgrade pip
    sudo "$INSTALL_DIR/venv/bin/pip" install -r auth-provider/requirements.txt
    sudo "$INSTALL_DIR/venv/bin/pip" install matrix-synapse[postgres]
    
    # Copy auth provider
    sudo cp -r auth-provider "$INSTALL_DIR/"
    
    sudo chown -R "$USER:staff" "$INSTALL_DIR"
}

# Configure PostgreSQL
setup_database() {
    echo "Setting up PostgreSQL..."
    
    # Create database and user
    createdb mycelium_chat
    psql -d postgres -c "CREATE USER mycelium_chat WITH PASSWORD 'mycelium_secure_password';"
    psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE mycelium_chat TO mycelium_chat;"
}

# Generate configuration files
generate_configs() {
    echo "Generating configuration files..."
    
    # Generate random secrets
    REGISTRATION_SECRET=$(openssl rand -hex 32)
    MACAROON_SECRET=$(openssl rand -hex 32)
    FORM_SECRET=$(openssl rand -hex 32)
    
    # Synapse configuration
    sudo tee "$CONFIG_DIR/homeserver.yaml" > /dev/null << EOF
server_name: "matrix.localhost"
pid_file: "$LOG_DIR/homeserver.pid"
web_client_location: "https://chat.threefold.pro"

listeners:
  - port: 8008
    tls: false
    type: http
    x_forwarded: true
    bind_addresses: ['::1', '127.0.0.1']
    resources:
      - names: [client, federation]
        compress: false

database:
  name: psycopg2
  args:
    user: mycelium_chat
    password: mycelium_secure_password
    database: mycelium_chat
    host: localhost
    cp_min: 5
    cp_max: 10

log_config: "$CONFIG_DIR/log.config"
media_store_path: "$DATA_DIR/media_store"
registration_shared_secret: "$REGISTRATION_SECRET"
report_stats: false
macaroon_secret_key: "$MACAROON_SECRET"
form_secret: "$FORM_SECRET"
signing_key_path: "$CONFIG_DIR/signing.key"

modules:
  - module: synapse_tf_connect.TFConnectAuthProvider
    config:
      config_file: "$CONFIG_DIR/tf_connect.yaml"

suppress_key_server_warning: true
enable_registration: false
enable_registration_without_verification: false
EOF

    # TF Connect auth configuration
    sudo tee "$CONFIG_DIR/tf_connect.yaml" > /dev/null << EOF
tf_connect:
  api_base_url: "https://login.threefold.me"
  websocket_url: "wss://login.threefold.me/websocket"
  app_id: "mycelium-chat"
  redirect_uri: "https://chat.threefold.pro/auth/callback"
  dev_mode: $DEV_MODE
  session_timeout: 3600
  log_level: "INFO"
  server_name: "matrix.localhost"
  log_file: "$LOG_DIR/tf_connect_auth.log"
EOF

    # Bridge configuration
    sudo tee "$CONFIG_DIR/bridge.toml" > /dev/null << EOF
[server]
name = "matrix.localhost"
matrix_url = "http://localhost:8008"
mycelium_url = "http://localhost:8989"
signing_key_path = "$CONFIG_DIR/bridge_signing.key"
max_users = 1000

[federation]
topic = "matrix.federation"
discovery_url = "https://discovery.threefold.pro"

[logging]
level = "info"
file = "$LOG_DIR/bridge.log"
EOF

    # Discovery service configuration
    sudo tee "$CONFIG_DIR/discovery.toml" > /dev/null << EOF
[server]
bind_address = "127.0.0.1"
port = 3000
max_servers = 1000

[cleanup]
interval_seconds = 300
stale_threshold_minutes = 10

[persistence]
enabled = true
file_path = "$DATA_DIR/servers.json"
save_interval_seconds = 60
EOF

    # Logging configuration
    sudo tee "$CONFIG_DIR/log.config" > /dev/null << EOF
version: 1

formatters:
  precise:
    format: '%(asctime)s - %(name)s - %(lineno)d - %(levelname)s - %(request)s - %(message)s'

handlers:
  file:
    class: logging.handlers.TimedRotatingFileHandler
    formatter: precise
    filename: $LOG_DIR/homeserver.log
    when: midnight
    backupCount: 3
    encoding: utf8

  console:
    class: logging.StreamHandler
    formatter: precise

loggers:
    synapse.storage.SQL:
        level: INFO

root:
    level: INFO
    handlers: [file, console]

disable_existing_loggers: false
EOF

    # Set permissions
    sudo chown -R "$USER:staff" "$CONFIG_DIR"
    sudo chmod 600 "$CONFIG_DIR"/*.yaml "$CONFIG_DIR"/*.toml
}

# Create LaunchDaemons
create_launch_daemons() {
    echo "Creating LaunchDaemons..."
    
    # Synapse service
    sudo tee /Library/LaunchDaemons/io.threefold.mycelium-chat.synapse.plist > /dev/null << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>io.threefold.mycelium-chat.synapse</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/venv/bin/python</string>
        <string>-m</string>
        <string>synapse.app.homeserver</string>
        <string>--config-path</string>
        <string>$CONFIG_DIR/homeserver.yaml</string>
    </array>
    <key>UserName</key>
    <string>$USER</string>
    <key>GroupName</key>
    <string>staff</string>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/synapse.out.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/synapse.err.log</string>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>
EOF

    # Bridge service
    sudo tee /Library/LaunchDaemons/io.threefold.mycelium-chat.bridge.plist > /dev/null << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>io.threefold.mycelium-chat.bridge</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/matrix-mycelium-bridge</string>
        <string>--config</string>
        <string>$CONFIG_DIR/bridge.toml</string>
    </array>
    <key>UserName</key>
    <string>$USER</string>
    <key>GroupName</key>
    <string>staff</string>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/bridge.out.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/bridge.err.log</string>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>
EOF

    # Discovery service
    sudo tee /Library/LaunchDaemons/io.threefold.mycelium-chat.discovery.plist > /dev/null << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>io.threefold.mycelium-chat.discovery</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/mycelium-discovery-service</string>
        <string>--config</string>
        <string>$CONFIG_DIR/discovery.toml</string>
    </array>
    <key>UserName</key>
    <string>$USER</string>
    <key>GroupName</key>
    <string>staff</string>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/discovery.out.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/discovery.err.log</string>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>
EOF
}

# Generate signing keys
generate_keys() {
    echo "Generating signing keys..."
    
    # Generate Synapse signing key
    sudo -u "$USER" "$INSTALL_DIR/venv/bin/python" -m synapse.app.homeserver \
        --generate-keys --config-path "$CONFIG_DIR/homeserver.yaml"
    
    # Generate bridge signing key
    openssl genpkey -algorithm Ed25519 -out "$CONFIG_DIR/bridge_signing.key"
    sudo chown "$USER:staff" "$CONFIG_DIR/bridge_signing.key"
    sudo chmod 600 "$CONFIG_DIR/bridge_signing.key"
}

# Start services
start_services() {
    echo "Starting services..."
    
    # Load and start LaunchDaemons
    sudo launchctl load /Library/LaunchDaemons/io.threefold.mycelium-chat.synapse.plist
    sleep 5
    sudo launchctl load /Library/LaunchDaemons/io.threefold.mycelium-chat.bridge.plist
    sudo launchctl load /Library/LaunchDaemons/io.threefold.mycelium-chat.discovery.plist
    
    # Check service status
    echo "Service status:"
    if sudo launchctl list | grep -q "io.threefold.mycelium-chat.synapse"; then
        echo "✓ Synapse: Running"
    else
        echo "✗ Synapse: Failed"
    fi
    
    if sudo launchctl list | grep -q "io.threefold.mycelium-chat.bridge"; then
        echo "✓ Bridge: Running"
    else
        echo "✗ Bridge: Failed"
    fi
    
    if sudo launchctl list | grep -q "io.threefold.mycelium-chat.discovery"; then
        echo "✓ Discovery: Running"
    else
        echo "✗ Discovery: Failed"
    fi
}

# Create application bundle
create_app_bundle() {
    echo "Creating application bundle..."
    
    APP_DIR="/Applications/Mycelium Chat.app"
    sudo mkdir -p "$APP_DIR/Contents/MacOS"
    sudo mkdir -p "$APP_DIR/Contents/Resources"
    
    # Create Info.plist
    sudo tee "$APP_DIR/Contents/Info.plist" > /dev/null << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>MyceliumChat</string>
    <key>CFBundleIdentifier</key>
    <string>io.threefold.mycelium-chat</string>
    <key>CFBundleName</key>
    <string>Mycelium Chat</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>MYCC</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>CFBundleIconFile</key>
    <string>icon</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

    # Create launcher script
    sudo tee "$APP_DIR/Contents/MacOS/MyceliumChat" > /dev/null << 'EOF'
#!/bin/bash
open "https://chat.threefold.pro"
EOF

    sudo chmod +x "$APP_DIR/Contents/MacOS/MyceliumChat"
}

# Create uninstaller
create_uninstaller() {
    sudo tee "$INSTALL_DIR/uninstall.sh" > /dev/null << 'EOF'
#!/bin/bash
# Mycelium Chat macOS Uninstaller

if [[ $EUID -eq 0 ]]; then
    echo "Error: This uninstaller should not be run as root. Run as a regular user with sudo access."
    exit 1
fi

echo "Uninstalling Mycelium Chat..."

# Stop and unload LaunchDaemons
sudo launchctl unload /Library/LaunchDaemons/io.threefold.mycelium-chat.bridge.plist 2>/dev/null || true
sudo launchctl unload /Library/LaunchDaemons/io.threefold.mycelium-chat.synapse.plist 2>/dev/null || true
sudo launchctl unload /Library/LaunchDaemons/io.threefold.mycelium-chat.discovery.plist 2>/dev/null || true

# Remove LaunchDaemon files
sudo rm -f /Library/LaunchDaemons/io.threefold.mycelium-chat.*.plist

# Remove directories
sudo rm -rf /usr/local/mycelium-chat
sudo rm -rf /usr/local/etc/mycelium-chat
sudo rm -rf /usr/local/var/log/mycelium-chat
sudo rm -rf /usr/local/var/lib/mycelium-chat

# Remove application bundle
sudo rm -rf "/Applications/Mycelium Chat.app"

# Remove user
sudo dscl . -delete /Users/_mycelium-chat 2>/dev/null || true

# Remove database (optional)
read -p "Remove PostgreSQL database? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    dropdb mycelium_chat 2>/dev/null || true
    psql -d postgres -c "DROP USER IF EXISTS mycelium_chat;" 2>/dev/null || true
fi

echo "Mycelium Chat has been uninstalled."
EOF

    sudo chmod +x "$INSTALL_DIR/uninstall.sh"
}

# Main installation process
main() {
    install_homebrew
    install_dependencies
    create_user
    create_directories
    install_mycelium_chat
    setup_database
    generate_configs
    create_launch_daemons
    generate_keys
    start_services
    create_app_bundle
    create_uninstaller
    
    echo ""
    echo "=== Installation Complete ==="
    echo "Mycelium Chat has been installed successfully!"
    echo ""
    echo "Services:"
    echo "  - io.threefold.mycelium-chat.synapse (Matrix homeserver)"
    echo "  - io.threefold.mycelium-chat.bridge (Mycelium bridge)"
    echo "  - io.threefold.mycelium-chat.discovery (Discovery service)"
    echo ""
    echo "Configuration: $CONFIG_DIR"
    echo "Logs: $LOG_DIR"
    echo "Data: $DATA_DIR"
    echo ""
    echo "Local homeserver: http://localhost:8008"
    echo "Discovery service: http://localhost:3000"
    echo "Web client: https://chat.threefold.pro"
    echo ""
    echo "Application: /Applications/Mycelium Chat.app"
    echo "To uninstall: $INSTALL_DIR/uninstall.sh"
    echo ""
    echo "View logs:"
    echo "  tail -f $LOG_DIR/synapse.out.log"
    echo "  tail -f $LOG_DIR/bridge.out.log"
    echo "  tail -f $LOG_DIR/discovery.out.log"
    
    if [[ "$SILENT" == "false" ]]; then
        read -p "Open Mycelium Chat now? (Y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            open "https://chat.threefold.pro"
        fi
    fi
}

# Run main installation
main "$@"
