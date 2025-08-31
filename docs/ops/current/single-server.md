# Single Server Setup Guide

Complete guide for deploying Mycelium Chat on a single server for testing or small community use.

## Overview

Single server deployment runs all Mycelium Chat components on one machine:
- Matrix Homeserver (Synapse)
- Matrix-Mycelium Bridge
- Discovery Service
- TF Connect Authentication Provider
- Element Web Client (optional)

This setup is ideal for:
- **Development and testing**
- **Small communities** (10-100 users)
- **Learning the system** before multi-server deployment
- **Private deployments** within organizations

## Prerequisites

### Hardware Requirements

**Minimum:**
- 2 CPU cores, 2.4GHz
- 4GB RAM
- 20GB SSD storage
- Stable internet connection

**Recommended:**
- 4 CPU cores, 3.0GHz
- 8GB RAM
- 50GB SSD storage
- 100Mbps+ internet connection

### Software Requirements

- **OS**: Ubuntu 22.04 LTS, Windows 10+, or macOS 10.15+
- **Rust**: 1.70+ with Cargo
- **Python**: 3.8+ with pip
- **PostgreSQL**: 12+ (or SQLite for testing)
- **Docker**: Latest stable (optional but recommended)

## Installation Methods

### Method 1: Automated Installer (Recommended)

**Linux/Ubuntu:**
```bash
# Download installer
curl -L https://github.com/mik-tf/mycelium-chat/releases/latest/download/install.sh -o install.sh
chmod +x install.sh

# Run installer
sudo ./install.sh

# Follow interactive prompts:
# - Server name (e.g., chat.example.com)
# - Database type (PostgreSQL/SQLite)
# - TF Connect app credentials
# - Enable TLS (y/n)
# - Admin email for certificates
```

**Windows:**
```powershell
# Download installer (as Administrator)
Invoke-WebRequest -Uri "https://github.com/mik-tf/mycelium-chat/releases/latest/download/install.ps1" -OutFile "install.ps1"
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Run installer
.\install.ps1

# Follow GUI installer prompts
```

**macOS:**
```bash
# Download installer
curl -L https://github.com/mik-tf/mycelium-chat/releases/latest/download/install-macos.sh -o install.sh
chmod +x install.sh

# Run installer
./install.sh

# Follow interactive prompts
```

### Method 2: Docker Compose

```bash
# Clone repository
git clone https://github.com/mik-tf/mycelium-chat.git
cd mycelium-chat

# Copy example environment
cp .env.example .env

# Edit configuration
nano .env

# Start services
docker-compose up -d

# Check status
docker-compose ps
```

### Method 3: Manual Installation

See [Manual Installation Guide](./manual-installation.md) for detailed step-by-step instructions.

## Configuration

### Basic Configuration

Create `/etc/mycelium-chat/config.yaml`:

```yaml
# Server Configuration
server:
  name: "chat.example.com"
  bind_address: "0.0.0.0"
  port: 8008
  tls:
    enabled: true
    cert_path: "/etc/letsencrypt/live/chat.example.com/fullchain.pem"
    key_path: "/etc/letsencrypt/live/chat.example.com/privkey.pem"

# Database Configuration
database:
  type: "postgresql"  # or "sqlite"
  host: "localhost"
  port: 5432
  name: "mycelium_chat"
  user: "mycelium"
  password: "secure_password_here"
  # For SQLite: path: "/var/lib/mycelium-chat/homeserver.db"

# TF Connect Integration
tf_connect:
  app_id: "your_tf_connect_app_id"
  app_secret: "your_tf_connect_app_secret"
  redirect_url: "https://chat.example.com/_matrix/client/tf_connect/callback"
  api_url: "https://login.threefold.me"

# Mycelium Configuration
mycelium:
  daemon_url: "http://localhost:8989"
  bridge_port: 8080
  
# Discovery Service
discovery:
  enabled: true
  port: 3000
  register_server: true
  
# Security
security:
  registration_shared_secret: "generate_random_secret_32_chars"
  macaroon_secret_key: "generate_random_secret_32_chars"
  form_secret: "generate_random_secret_32_chars"
  
# Logging
logging:
  level: "INFO"
  path: "/var/log/mycelium-chat/"
  
# Optional: Metrics
metrics:
  enabled: true
  port: 9090
```

### Generate Secrets

```bash
# Generate secure secrets
python3 -c "import secrets; print('registration_shared_secret:', secrets.token_urlsafe(32))"
python3 -c "import secrets; print('macaroon_secret_key:', secrets.token_urlsafe(32))"
python3 -c "import secrets; print('form_secret:', secrets.token_urlsafe(32))"
```

### Database Setup

**PostgreSQL (Recommended):**
```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql << EOF
CREATE USER mycelium WITH PASSWORD 'secure_password_here';
CREATE DATABASE mycelium_chat OWNER mycelium;
GRANT ALL PRIVILEGES ON DATABASE mycelium_chat TO mycelium;
\q
EOF

# Test connection
psql -h localhost -U mycelium -d mycelium_chat -c "SELECT version();"
```

**SQLite (Testing):**
```bash
# Create data directory
sudo mkdir -p /var/lib/mycelium-chat
sudo chown mycelium-chat:mycelium-chat /var/lib/mycelium-chat

# SQLite database will be created automatically
```

### TLS Configuration

**Let's Encrypt (Production):**
```bash
# Install Certbot
sudo apt install certbot

# Obtain certificate
sudo certbot certonly --standalone -d chat.example.com

# Configure auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet --post-hook "systemctl reload mycelium-chat-synapse"
```

**Self-Signed (Testing):**
```bash
# Generate certificate
sudo mkdir -p /etc/mycelium-chat/tls
sudo openssl req -x509 -newkey rsa:4096 \
  -keyout /etc/mycelium-chat/tls/key.pem \
  -out /etc/mycelium-chat/tls/cert.pem \
  -days 365 -nodes \
  -subj "/CN=chat.example.com"

# Set permissions
sudo chown mycelium-chat:mycelium-chat /etc/mycelium-chat/tls/*
sudo chmod 600 /etc/mycelium-chat/tls/key.pem
```

## Service Management

### Start Services

**Linux (systemd):**
```bash
# Start all services
sudo systemctl start mycelium-chat-synapse
sudo systemctl start mycelium-chat-bridge
sudo systemctl start mycelium-chat-discovery

# Enable auto-start
sudo systemctl enable mycelium-chat-synapse
sudo systemctl enable mycelium-chat-bridge
sudo systemctl enable mycelium-chat-discovery

# Check status
sudo systemctl status mycelium-chat-*
```

**Docker Compose:**
```bash
# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f synapse
docker-compose logs -f bridge
docker-compose logs -f discovery
```

### Service Dependencies

Services start in this order:
1. **PostgreSQL** (if used)
2. **Mycelium daemon**
3. **Discovery Service**
4. **Matrix Homeserver (Synapse)**
5. **Matrix-Mycelium Bridge**

## Testing and Verification

### Health Checks

```bash
# Check Matrix server
curl https://chat.example.com/_matrix/client/versions

# Expected response:
# {"versions":["r0.0.1","r0.1.0","r0.2.0",...]}

# Check bridge
curl http://localhost:8080/health

# Expected response:
# {"status":"healthy","version":"1.0.0"}

# Check discovery service
curl http://localhost:3000/servers

# Expected response:
# {"servers":[{"name":"chat.example.com",...}],"total":1}

# Check Mycelium daemon
curl http://localhost:8989/api/v1/peers

# Expected response:
# {"peers":[...],"count":N}
```

### Create Test User

```bash
# Register admin user
curl -X POST https://chat.example.com/_synapse/admin/v1/register \
  -H "Content-Type: application/json" \
  -d '{
    "nonce": "admin_nonce",
    "username": "admin",
    "password": "secure_admin_password",
    "admin": true,
    "mac": "generated_mac_here"
  }'

# Generate MAC with registration shared secret
python3 << EOF
import hmac, hashlib, json
secret = "your_registration_shared_secret"
nonce = "admin_nonce"
username = "admin"
password = "secure_admin_password"
admin = True

mac = hmac.new(
    secret.encode(),
    f"{nonce}\0{username}\0{password}\0{'admin' if admin else 'notadmin'}".encode(),
    hashlib.sha1
).hexdigest()
print(f"MAC: {mac}")
EOF
```

### Test Element Web Client

1. **Access Element**: Open `https://chat.example.com`
2. **Sign In**: Click "Sign In" button
3. **TF Connect**: Select "ThreeFold Connect" option
4. **Authenticate**: Complete TF Connect login flow
5. **Create Room**: Create a test room
6. **Send Message**: Send a test message
7. **Verify**: Confirm message appears correctly

### Test Federation (Single Server)

```bash
# Run integration tests
cd /opt/mycelium-chat/tests/integration
./test_runner.sh --integration-only

# Expected output:
# ✓ Discovery service test passed
# ✓ Bridge health check passed  
# ✓ Basic federation test passed
# ✓ All integration tests passed!
```

## Monitoring and Maintenance

### Log Monitoring

**Key log files:**
```bash
# Synapse logs
tail -f /var/log/mycelium-chat/synapse.log

# Bridge logs
tail -f /var/log/mycelium-chat/bridge.log

# Discovery service logs
tail -f /var/log/mycelium-chat/discovery.log

# System logs
sudo journalctl -u mycelium-chat-* -f
```

**Important log patterns to monitor:**
- Authentication failures
- Federation errors
- Database connection issues
- High memory/CPU usage warnings
- TLS certificate expiration

### Performance Monitoring

**System resources:**
```bash
# CPU and memory usage
htop

# Disk usage
df -h
du -sh /var/lib/mycelium-chat/*

# Network connections
netstat -tulpn | grep -E "(8008|8080|3000|8989)"

# Database performance (PostgreSQL)
sudo -u postgres psql mycelium_chat -c "
SELECT schemaname,tablename,attname,n_distinct,correlation 
FROM pg_stats WHERE tablename='events';
"
```

**Metrics collection:**
```bash
# Enable Prometheus metrics
curl http://localhost:9090/metrics

# Key metrics to monitor:
# - synapse_http_requests_total
# - synapse_federation_transactions_total  
# - mycelium_bridge_messages_total
# - discovery_service_registrations_total
```

### Backup Procedures

**Database backup:**
```bash
# PostgreSQL backup
pg_dump -h localhost -U mycelium mycelium_chat > backup_$(date +%Y%m%d_%H%M%S).sql

# SQLite backup
sqlite3 /var/lib/mycelium-chat/homeserver.db ".backup backup_$(date +%Y%m%d_%H%M%S).db"
```

**Configuration backup:**
```bash
# Backup all configuration
tar -czf mycelium_chat_config_$(date +%Y%m%d).tar.gz \
  /etc/mycelium-chat/ \
  /var/lib/mycelium-chat/signing.key \
  /var/lib/mycelium-chat/bridge_signing.key

# Store backup securely
scp mycelium_chat_config_*.tar.gz backup-server:/secure/backups/
```

**Automated backup script:**
```bash
#!/bin/bash
# /usr/local/bin/backup-mycelium-chat.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/mycelium-chat"
mkdir -p $BACKUP_DIR

# Database backup
pg_dump -h localhost -U mycelium mycelium_chat > $BACKUP_DIR/db_$DATE.sql

# Configuration backup
tar -czf $BACKUP_DIR/config_$DATE.tar.gz /etc/mycelium-chat/

# Clean old backups (keep 7 days)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

**Schedule backups:**
```bash
# Add to crontab
sudo crontab -e

# Daily backup at 2 AM
0 2 * * * /usr/local/bin/backup-mycelium-chat.sh >> /var/log/mycelium-chat/backup.log 2>&1
```

## Troubleshooting

### Common Issues

**1. Synapse won't start:**
```bash
# Check configuration syntax
python3 -m synapse.app.homeserver --config-path /etc/mycelium-chat/homeserver.yaml --generate-config

# Check database connection
psql -h localhost -U mycelium -d mycelium_chat -c "SELECT 1;"

# Check permissions
sudo chown -R mycelium-chat:mycelium-chat /var/lib/mycelium-chat/
sudo chmod 600 /etc/mycelium-chat/homeserver.yaml
```

**2. TF Connect authentication fails:**
```bash
# Check TF Connect configuration
grep -A 10 "tf_connect" /etc/mycelium-chat/homeserver.yaml

# Test TF Connect API
curl -v "https://login.threefold.me/api/users/me" \
  -H "Authorization: Bearer test_token"

# Check auth provider logs
grep "tf_connect" /var/log/mycelium-chat/synapse.log | tail -20
```

**3. Bridge connection issues:**
```bash
# Check Mycelium daemon
curl http://localhost:8989/api/v1/peers

# Check bridge configuration
cat /etc/mycelium-chat/bridge.toml

# Test bridge connectivity
curl http://localhost:8080/health

# Check bridge logs
tail -f /var/log/mycelium-chat/bridge.log
```

**4. Discovery service problems:**
```bash
# Check discovery service
curl http://localhost:3000/servers

# Check registration
curl -X POST http://localhost:3000/servers/register \
  -H "Content-Type: application/json" \
  -d '{"server_name":"test","mycelium_address":"127.0.0.1:8080",...}'

# Check discovery logs
tail -f /var/log/mycelium-chat/discovery.log
```

### Performance Issues

**High CPU usage:**
```bash
# Check process usage
top -p $(pgrep -f synapse)

# Check database queries
sudo -u postgres psql mycelium_chat -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY total_time DESC LIMIT 10;
"

# Optimize database
sudo -u postgres psql mycelium_chat -c "VACUUM ANALYZE;"
```

**High memory usage:**
```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head -10

# Adjust Synapse cache settings in homeserver.yaml:
# caches:
#   global_factor: 0.5  # Reduce from default 1.0
```

**Disk space issues:**
```bash
# Check disk usage
df -h
du -sh /var/lib/mycelium-chat/*
du -sh /var/log/mycelium-chat/*

# Clean old logs
sudo find /var/log/mycelium-chat/ -name "*.log.*" -mtime +30 -delete

# Clean old media (be careful!)
# See Synapse documentation for media cleanup
```

## Security Hardening

### Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH
sudo ufw allow ssh

# Allow Matrix (HTTPS)
sudo ufw allow 443/tcp

# Allow Matrix (HTTP for Let's Encrypt)
sudo ufw allow 80/tcp

# Optionally allow Matrix HTTP (if not using reverse proxy)
sudo ufw allow 8008/tcp

# Check status
sudo ufw status verbose
```

### System Security

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install security updates automatically
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Configure fail2ban for SSH protection
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### Application Security

```bash
# Set secure file permissions
sudo chmod 600 /etc/mycelium-chat/homeserver.yaml
sudo chmod 600 /var/lib/mycelium-chat/*.key
sudo chown -R mycelium-chat:mycelium-chat /etc/mycelium-chat/
sudo chown -R mycelium-chat:mycelium-chat /var/lib/mycelium-chat/

# Disable unnecessary services
sudo systemctl disable apache2  # if not needed
sudo systemctl disable nginx    # if not using reverse proxy
```

## Scaling Considerations

### When to Scale

Consider multi-server deployment when:
- **Users**: >100 active users
- **Messages**: >10,000 messages/day
- **Storage**: >10GB database size
- **CPU**: Consistently >80% usage
- **Memory**: Consistently >80% usage
- **Reliability**: Need redundancy/high availability

### Migration Path

1. **Backup current server** completely
2. **Set up second server** following [Multi-Server Guide](./multi-server.md)
3. **Test federation** between servers
4. **Migrate users gradually** or all at once
5. **Update DNS/load balancing** as needed
6. **Monitor performance** and adjust

## Next Steps

After successful single server deployment:

1. **Monitor performance** and resource usage
2. **Set up regular backups** and test restore procedures
3. **Configure monitoring/alerting** for production use
4. **Plan scaling strategy** for growth
5. **Consider multi-server federation** for redundancy

For multi-server deployment, see [Multi-Server Federation Guide](./multi-server.md).
