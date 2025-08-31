# Mycelium Chat Deployment Guide

Complete deployment guide for Matrix-Mycelium federation system.

## Overview

Mycelium Chat uses a distributed architecture where multiple Matrix homeservers federate via Mycelium P2P networking. This guide covers deployment from single local testing to production multi-server federation.

## Deployment Options

### 1. Single Local Test (Development)
- **Purpose**: Testing and development
- **Components**: All services on one machine
- **Network**: Local Docker network
- **Users**: 1-10 test users

### 2. Single Production Server
- **Purpose**: Small community deployment
- **Components**: All services on one server
- **Network**: Mycelium P2P + local networking
- **Users**: 10-100 users

### 3. Multi-Server Federation
- **Purpose**: Large-scale production deployment
- **Components**: Distributed across multiple servers
- **Network**: Full Mycelium P2P federation
- **Users**: 100+ users across multiple homeservers

## Prerequisites

### System Requirements

**Minimum (Single Server):**
- **CPU**: 2 cores, 2.4GHz
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **Network**: Stable internet connection
- **OS**: Ubuntu 20.04+, Windows 10+, macOS 10.15+

**Recommended (Production):**
- **CPU**: 4+ cores, 3.0GHz
- **RAM**: 8GB+
- **Storage**: 50GB+ SSD
- **Network**: 100Mbps+ connection
- **OS**: Ubuntu 22.04 LTS

### Software Dependencies

**Required:**
- **Rust**: 1.70+ with Cargo
- **Python**: 3.8+ with pip
- **PostgreSQL**: 12+ (or SQLite for testing)
- **Docker & Docker Compose**: Latest stable

**Optional:**
- **Nginx**: For reverse proxy (production)
- **Certbot**: For TLS certificates
- **Redis**: For authentication caching

## Quick Deployment

### Option 1: Automated Installers

**Windows:**
```powershell
# Download installer
Invoke-WebRequest -Uri "https://github.com/mik-tf/mycelium-chat/releases/latest/download/install.ps1" -OutFile "install.ps1"

# Run installer (as Administrator)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\install.ps1

# Follow prompts for configuration
```

**Linux:**
```bash
# Download installer
curl -L https://github.com/mik-tf/mycelium-chat/releases/latest/download/install.sh -o install.sh
chmod +x install.sh

# Run installer
sudo ./install.sh

# Follow prompts for configuration
```

**macOS:**
```bash
# Download installer
curl -L https://github.com/mik-tf/mycelium-chat/releases/latest/download/install-macos.sh -o install.sh
chmod +x install.sh

# Run installer
./install.sh

# Follow prompts for configuration
```

### Option 2: Docker Compose (Development)

```bash
# Clone repository
git clone https://github.com/mik-tf/mycelium-chat.git
cd mycelium-chat

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Access services:
# - Element Web: http://localhost:8080
# - Matrix Server: http://localhost:8008
# - Discovery Service: http://localhost:3000
```

### Option 3: Manual Installation

See [Manual Installation Guide](./manual-installation.md) for step-by-step instructions.

## Configuration

### Environment Variables

Create `.env` file in project root:

```bash
# Server Configuration
SERVER_NAME=your-server.example.com
MATRIX_PORT=8008
BRIDGE_PORT=8080
DISCOVERY_PORT=3000

# Database Configuration
DATABASE_URL=postgresql://mycelium:password@localhost/mycelium_chat
# Or for SQLite: DATABASE_URL=sqlite:///data/homeserver.db

# TF Connect Configuration
TF_CONNECT_APP_ID=your_app_id
TF_CONNECT_REDIRECT_URL=https://your-server.example.com/_matrix/client/tf_connect/callback

# Security
REGISTRATION_SHARED_SECRET=generate_random_secret_here
MACAROON_SECRET_KEY=generate_random_secret_here
FORM_SECRET=generate_random_secret_here

# Optional: Redis for caching
REDIS_URL=redis://localhost:6379/0

# Optional: Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
```

### Generate Secrets

```bash
# Generate secure random secrets
python3 -c "import secrets; print('REGISTRATION_SHARED_SECRET=' + secrets.token_urlsafe(32))"
python3 -c "import secrets; print('MACAROON_SECRET_KEY=' + secrets.token_urlsafe(32))"
python3 -c "import secrets; print('FORM_SECRET=' + secrets.token_urlsafe(32))"
```

### TLS Configuration (Production)

**Option 1: Let's Encrypt (Recommended)**
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-server.example.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

**Option 2: Self-Signed (Testing)**
```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

## Service Management

### Systemd Services (Linux)

Services are automatically created by the installer:

```bash
# Check service status
sudo systemctl status mycelium-chat-synapse
sudo systemctl status mycelium-chat-bridge
sudo systemctl status mycelium-chat-discovery

# Start/stop services
sudo systemctl start mycelium-chat-synapse
sudo systemctl stop mycelium-chat-bridge
sudo systemctl restart mycelium-chat-discovery

# Enable/disable auto-start
sudo systemctl enable mycelium-chat-synapse
sudo systemctl disable mycelium-chat-bridge

# View logs
sudo journalctl -u mycelium-chat-synapse -f
```

### Windows Services

Services are managed via Windows Service Manager or PowerShell:

```powershell
# Check service status
Get-Service MyceliumChat*

# Start/stop services
Start-Service MyceliumChatSynapse
Stop-Service MyceliumChatBridge
Restart-Service MyceliumChatDiscovery

# View logs (Event Viewer or log files)
Get-EventLog -LogName Application -Source MyceliumChat*
```

### macOS LaunchDaemons

```bash
# Check service status
sudo launchctl list | grep mycelium

# Start/stop services
sudo launchctl load /Library/LaunchDaemons/com.threefold.mycelium-chat.synapse.plist
sudo launchctl unload /Library/LaunchDaemons/com.threefold.mycelium-chat.bridge.plist

# View logs
tail -f /usr/local/var/log/mycelium-chat/synapse.log
```

## Verification

### Health Checks

```bash
# Check Matrix server
curl http://localhost:8008/_matrix/client/versions

# Check bridge
curl http://localhost:8080/health

# Check discovery service
curl http://localhost:3000/servers

# Check Mycelium daemon
curl http://localhost:8989/api/v1/peers
```

### Test Federation

```bash
# Run integration tests
cd tests/integration
./test_runner.sh --integration-only

# Manual federation test
# 1. Create user on server A
# 2. Create user on server B  
# 3. Create room and invite cross-server
# 4. Send messages and verify delivery
```

### Element Web Client

1. Open browser to `https://your-server.example.com`
2. Click "Sign In"
3. Select "ThreeFold Connect"
4. Complete TF Connect authentication
5. Verify you can create rooms and send messages

## Monitoring

### Metrics Collection

Enable Prometheus metrics in configuration:

```yaml
# homeserver.yaml
enable_metrics: true
listeners:
  - port: 9090
    type: metrics
    bind_addresses: ['127.0.0.1']
```

### Log Monitoring

**Important log locations:**
- **Synapse**: `/var/log/mycelium-chat/synapse.log`
- **Bridge**: `/var/log/mycelium-chat/bridge.log`
- **Discovery**: `/var/log/mycelium-chat/discovery.log`
- **Mycelium**: `/var/log/mycelium/mycelium.log`

**Log rotation:**
```bash
# Configure logrotate
sudo tee /etc/logrotate.d/mycelium-chat << EOF
/var/log/mycelium-chat/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    postrotate
        systemctl reload mycelium-chat-*
    endscript
}
EOF
```

### Alerting

Set up monitoring for:
- Service availability
- Federation connectivity
- Database performance
- Disk space usage
- Memory consumption
- Error rates in logs

## Backup and Recovery

### Database Backup

**PostgreSQL:**
```bash
# Create backup
pg_dump mycelium_chat > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
psql mycelium_chat < backup_20231201_120000.sql
```

**SQLite:**
```bash
# Create backup
sqlite3 /data/homeserver.db ".backup backup_$(date +%Y%m%d_%H%M%S).db"

# Restore backup
cp backup_20231201_120000.db /data/homeserver.db
```

### Configuration Backup

```bash
# Backup configuration
tar -czf config_backup_$(date +%Y%m%d).tar.gz \
    /etc/mycelium-chat/ \
    /usr/local/etc/mycelium-chat/ \
    ~/.config/mycelium-chat/

# Restore configuration
tar -xzf config_backup_20231201.tar.gz -C /
```

### Signing Keys Backup

**Critical**: Always backup Matrix signing keys!

```bash
# Backup signing keys
cp /etc/mycelium-chat/signing.key /secure/backup/location/
cp /etc/mycelium-chat/bridge_signing.key /secure/backup/location/

# Store securely offline or in encrypted storage
```

## Troubleshooting

### Common Issues

**1. Services won't start**
```bash
# Check logs
sudo journalctl -u mycelium-chat-synapse -n 50

# Check configuration
mycelium-chat-synapse --config-path /etc/mycelium-chat/homeserver.yaml --generate-config

# Check permissions
sudo chown -R mycelium-chat:mycelium-chat /var/lib/mycelium-chat/
```

**2. Federation not working**
```bash
# Check Mycelium connectivity
mycelium inspect

# Check bridge logs
tail -f /var/log/mycelium-chat/bridge.log

# Test discovery service
curl http://localhost:3000/servers
```

**3. Authentication failures**
```bash
# Check TF Connect configuration
grep -r "tf_connect" /etc/mycelium-chat/

# Test auth provider
python3 -m mycelium_chat.auth.test_tf_connect

# Check auth logs
grep "tf_connect" /var/log/mycelium-chat/synapse.log
```

**4. Performance issues**
```bash
# Check resource usage
htop
df -h
iostat -x 1

# Check database performance
sudo -u postgres psql mycelium_chat -c "SELECT * FROM pg_stat_activity;"

# Run performance tests
cd tests/integration
./test_runner.sh --performance
```

### Getting Help

1. **Check logs** for detailed error messages
2. **Run diagnostics** with built-in test tools
3. **Consult documentation** for specific components
4. **Search issues** in the GitHub repository
5. **Ask community** in ThreeFold forums or Matrix rooms

## Security Considerations

### Network Security
- Use TLS for all external communications
- Configure firewall to limit exposed ports
- Use VPN or private networks when possible
- Regular security updates

### Access Control
- Strong passwords and key management
- Limit administrative access
- Regular access reviews
- Multi-factor authentication where possible

### Data Protection
- Encrypt data at rest
- Secure backup storage
- Regular security audits
- Compliance with data protection regulations

## Next Steps

After successful deployment:

1. **Configure monitoring** and alerting
2. **Set up backups** and test recovery procedures
3. **Join the federation** by registering with discovery service
4. **Invite users** to test the system
5. **Scale horizontally** by adding more homeservers

For multi-server federation setup, see [Multi-Server Federation Guide](./multi-server.md).
