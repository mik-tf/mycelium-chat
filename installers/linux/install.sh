#!/bin/bash
# Mycelium Chat Linux Installer
# Bash script to install Matrix homeserver + Mycelium bridge on Linux

set -e

# Configuration
INSTALL_DIR="/opt/mycelium-chat"
CONFIG_DIR="/etc/mycelium-chat"
LOG_DIR="/var/log/mycelium-chat"
DATA_DIR="/var/lib/mycelium-chat"
USER="mycelium-chat"
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
            echo "Mycelium Chat Linux Installer"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --install-dir DIR    Installation directory (default: /opt/mycelium-chat)"
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
if [[ $EUID -ne 0 ]]; then
    echo "Error: This installer must be run as root (use sudo)"
    exit 1
fi

echo "=== Mycelium Chat Linux Installer ==="
echo "Installing to: $INSTALL_DIR"

# Detect Linux distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    DISTRO=$ID
    VERSION=$VERSION_ID
else
    echo "Error: Cannot detect Linux distribution"
    exit 1
fi

echo "Detected: $PRETTY_NAME"

# Install dependencies based on distribution
install_dependencies() {
    echo "Installing dependencies..."
    
    case $DISTRO in
        ubuntu|debian)
            apt-get update
            apt-get install -y curl wget git build-essential python3 python3-pip python3-venv \
                postgresql postgresql-contrib nginx certbot python3-certbot-nginx \
                pkg-config libssl-dev libffi-dev libpq-dev redis-server
            
            # Install Rust
            if ! command -v cargo &> /dev/null; then
                curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
                source ~/.cargo/env
            fi
            
            # Install Node.js
            if ! command -v node &> /dev/null; then
                curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
                apt-get install -y nodejs
            fi
            ;;
            
        fedora|centos|rhel)
            if command -v dnf &> /dev/null; then
                dnf update -y
                dnf install -y curl wget git gcc gcc-c++ python3 python3-pip python3-virtualenv \
                    postgresql postgresql-server postgresql-contrib nginx certbot python3-certbot-nginx \
                    openssl-devel libffi-devel postgresql-devel redis
            else
                yum update -y
                yum install -y curl wget git gcc gcc-c++ python3 python3-pip python3-virtualenv \
                    postgresql postgresql-server postgresql-contrib nginx certbot python3-certbot-nginx \
                    openssl-devel libffi-devel postgresql-devel redis
            fi
            
            # Initialize PostgreSQL
            if [ ! -f /var/lib/pgsql/data/postgresql.conf ]; then
                postgresql-setup --initdb
            fi
            
            # Install Rust
            if ! command -v cargo &> /dev/null; then
                curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
                source ~/.cargo/env
            fi
            
            # Install Node.js
            if ! command -v node &> /dev/null; then
                curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
                if command -v dnf &> /dev/null; then
                    dnf install -y nodejs
                else
                    yum install -y nodejs
                fi
            fi
            ;;
            
        arch)
            pacman -Syu --noconfirm
            pacman -S --noconfirm curl wget git base-devel python python-pip python-virtualenv \
                postgresql nginx certbot certbot-nginx openssl libffi postgresql-libs redis
            
            # Install Rust
            if ! command -v cargo &> /dev/null; then
                curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
                source ~/.cargo/env
            fi
            
            # Install Node.js
            if ! command -v node &> /dev/null; then
                pacman -S --noconfirm nodejs npm
            fi
            
            # Initialize PostgreSQL
            if [ ! -f /var/lib/postgres/data/postgresql.conf ]; then
                sudo -u postgres initdb -D /var/lib/postgres/data
            fi
            ;;
            
        *)
            echo "Error: Unsupported distribution: $DISTRO"
            echo "Please install dependencies manually and run the installer again."
            exit 1
            ;;
    esac
}

# Create system user
create_user() {
    echo "Creating system user..."
    if ! id "$USER" &>/dev/null; then
        useradd --system --home-dir "$DATA_DIR" --shell /bin/false "$USER"
    fi
}

# Create directories
create_directories() {
    echo "Creating directories..."
    mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" "$LOG_DIR" "$DATA_DIR"
    chown -R "$USER:$USER" "$INSTALL_DIR" "$LOG_DIR" "$DATA_DIR"
    chmod 755 "$CONFIG_DIR"
}

# Download and build Mycelium Chat
install_mycelium_chat() {
    echo "Downloading Mycelium Chat..."
    
    cd "$INSTALL_DIR"
    if [ -d "mycelium-chat" ]; then
        rm -rf mycelium-chat
    fi
    
    git clone https://github.com/threefoldtech/mycelium-chat.git
    cd mycelium-chat
    
    echo "Building Rust components..."
    cargo build --release
    
    # Copy binaries
    cp target/release/matrix-mycelium-bridge "$INSTALL_DIR/"
    cp target/release/mycelium-discovery-service "$INSTALL_DIR/"
    
    # Install Python dependencies
    echo "Installing Python dependencies..."
    python3 -m venv "$INSTALL_DIR/venv"
    source "$INSTALL_DIR/venv/bin/activate"
    pip install --upgrade pip
    pip install -r auth-provider/requirements.txt
    pip install matrix-synapse[postgres]
    
    # Copy auth provider
    cp -r auth-provider "$INSTALL_DIR/"
    
    chown -R "$USER:$USER" "$INSTALL_DIR"
}

# Configure PostgreSQL
setup_database() {
    echo "Setting up PostgreSQL..."
    
    # Start PostgreSQL
    systemctl enable postgresql
    systemctl start postgresql
    
    # Create database and user
    sudo -u postgres psql -c "CREATE USER mycelium_chat WITH PASSWORD 'mycelium_secure_password';"
    sudo -u postgres psql -c "CREATE DATABASE mycelium_chat OWNER mycelium_chat;"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE mycelium_chat TO mycelium_chat;"
}

# Generate configuration files
generate_configs() {
    echo "Generating configuration files..."
    
    # Generate random secrets
    REGISTRATION_SECRET=$(openssl rand -hex 32)
    MACAROON_SECRET=$(openssl rand -hex 32)
    FORM_SECRET=$(openssl rand -hex 32)
    
    # Synapse configuration
    cat > "$CONFIG_DIR/homeserver.yaml" << EOF
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

# Federation settings
federation_domain_whitelist: []
federation_ip_range_blacklist:
  - '127.0.0.0/8'
  - '10.0.0.0/8'
  - '172.16.0.0/12'
  - '192.168.0.0/16'
  - '100.64.0.0/10'
  - '169.254.0.0/16'
  - '::1/128'
  - 'fe80::/64'
  - 'fc00::/7'
EOF

    # TF Connect auth configuration
    cat > "$CONFIG_DIR/tf_connect.yaml" << EOF
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
    cat > "$CONFIG_DIR/bridge.toml" << EOF
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
    cat > "$CONFIG_DIR/discovery.toml" << EOF
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
    cat > "$CONFIG_DIR/log.config" << EOF
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
    chown -R "$USER:$USER" "$CONFIG_DIR"
    chmod 600 "$CONFIG_DIR"/*.yaml "$CONFIG_DIR"/*.toml
}

# Create systemd services
create_services() {
    echo "Creating systemd services..."
    
    # Synapse service
    cat > /etc/systemd/system/mycelium-chat-synapse.service << EOF
[Unit]
Description=Matrix Synapse homeserver for Mycelium Chat
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$INSTALL_DIR
Environment=PATH=$INSTALL_DIR/venv/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=$INSTALL_DIR/venv/bin/python -m synapse.app.homeserver --config-path $CONFIG_DIR/homeserver.yaml
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mycelium-chat-synapse

[Install]
WantedBy=multi-user.target
EOF

    # Bridge service
    cat > /etc/systemd/system/mycelium-chat-bridge.service << EOF
[Unit]
Description=Matrix-Mycelium bridge for decentralized federation
After=network.target mycelium-chat-synapse.service
Wants=mycelium-chat-synapse.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/matrix-mycelium-bridge --config $CONFIG_DIR/bridge.toml
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mycelium-chat-bridge

[Install]
WantedBy=multi-user.target
EOF

    # Discovery service
    cat > /etc/systemd/system/mycelium-chat-discovery.service << EOF
[Unit]
Description=Mycelium Chat discovery service
After=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/mycelium-discovery-service --config $CONFIG_DIR/discovery.toml
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mycelium-chat-discovery

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd
    systemctl daemon-reload
}

# Generate signing keys
generate_keys() {
    echo "Generating signing keys..."
    
    # Generate Synapse signing key
    sudo -u "$USER" "$INSTALL_DIR/venv/bin/python" -m synapse.app.homeserver \
        --generate-keys --config-path "$CONFIG_DIR/homeserver.yaml"
    
    # Generate bridge signing key
    openssl genpkey -algorithm Ed25519 -out "$CONFIG_DIR/bridge_signing.key"
    chown "$USER:$USER" "$CONFIG_DIR/bridge_signing.key"
    chmod 600 "$CONFIG_DIR/bridge_signing.key"
}

# Configure nginx (optional)
configure_nginx() {
    if [[ "$SILENT" == "false" ]]; then
        read -p "Configure nginx reverse proxy? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return
        fi
    fi
    
    echo "Configuring nginx..."
    
    cat > /etc/nginx/sites-available/mycelium-chat << EOF
server {
    listen 80;
    server_name matrix.localhost;
    
    location /_matrix {
        proxy_pass http://127.0.0.1:8008;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Host \$host;
        
        # Increase timeouts for large file uploads
        client_max_body_size 50M;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
    
    location /_synapse/client {
        proxy_pass http://127.0.0.1:8008;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Host \$host;
    }
}
EOF

    # Enable site
    ln -sf /etc/nginx/sites-available/mycelium-chat /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
}

# Start services
start_services() {
    echo "Starting services..."
    
    # Enable and start services
    systemctl enable mycelium-chat-synapse
    systemctl enable mycelium-chat-bridge
    systemctl enable mycelium-chat-discovery
    
    systemctl start mycelium-chat-synapse
    sleep 5
    systemctl start mycelium-chat-bridge
    systemctl start mycelium-chat-discovery
    
    # Check service status
    echo "Service status:"
    systemctl is-active mycelium-chat-synapse && echo "✓ Synapse: Running" || echo "✗ Synapse: Failed"
    systemctl is-active mycelium-chat-bridge && echo "✓ Bridge: Running" || echo "✗ Bridge: Failed"
    systemctl is-active mycelium-chat-discovery && echo "✓ Discovery: Running" || echo "✗ Discovery: Failed"
}

# Create uninstaller
create_uninstaller() {
    cat > "$INSTALL_DIR/uninstall.sh" << 'EOF'
#!/bin/bash
# Mycelium Chat Uninstaller

if [[ $EUID -ne 0 ]]; then
    echo "Error: This uninstaller must be run as root (use sudo)"
    exit 1
fi

echo "Uninstalling Mycelium Chat..."

# Stop and disable services
systemctl stop mycelium-chat-bridge mycelium-chat-synapse mycelium-chat-discovery
systemctl disable mycelium-chat-bridge mycelium-chat-synapse mycelium-chat-discovery

# Remove service files
rm -f /etc/systemd/system/mycelium-chat-*.service
systemctl daemon-reload

# Remove nginx configuration
rm -f /etc/nginx/sites-enabled/mycelium-chat
rm -f /etc/nginx/sites-available/mycelium-chat
nginx -t && systemctl reload nginx 2>/dev/null || true

# Remove directories
rm -rf /opt/mycelium-chat
rm -rf /etc/mycelium-chat
rm -rf /var/log/mycelium-chat
rm -rf /var/lib/mycelium-chat

# Remove user
userdel mycelium-chat 2>/dev/null || true

# Remove database (optional)
read -p "Remove PostgreSQL database? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo -u postgres psql -c "DROP DATABASE IF EXISTS mycelium_chat;"
    sudo -u postgres psql -c "DROP USER IF EXISTS mycelium_chat;"
fi

echo "Mycelium Chat has been uninstalled."
EOF

    chmod +x "$INSTALL_DIR/uninstall.sh"
}

# Main installation process
main() {
    install_dependencies
    create_user
    create_directories
    install_mycelium_chat
    setup_database
    generate_configs
    create_services
    generate_keys
    configure_nginx
    start_services
    create_uninstaller
    
    echo ""
    echo "=== Installation Complete ==="
    echo "Mycelium Chat has been installed successfully!"
    echo ""
    echo "Services:"
    echo "  - mycelium-chat-synapse (Matrix homeserver)"
    echo "  - mycelium-chat-bridge (Mycelium bridge)"
    echo "  - mycelium-chat-discovery (Discovery service)"
    echo ""
    echo "Configuration: $CONFIG_DIR"
    echo "Logs: $LOG_DIR"
    echo "Data: $DATA_DIR"
    echo ""
    echo "Local homeserver: http://localhost:8008"
    echo "Discovery service: http://localhost:3000"
    echo "Web client: https://chat.threefold.pro"
    echo ""
    echo "To uninstall: sudo $INSTALL_DIR/uninstall.sh"
    echo ""
    echo "View logs:"
    echo "  journalctl -u mycelium-chat-synapse -f"
    echo "  journalctl -u mycelium-chat-bridge -f"
    echo "  journalctl -u mycelium-chat-discovery -f"
}

# Run main installation
main "$@"
