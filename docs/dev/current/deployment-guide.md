# Deployment Guide

## Overview

This guide covers all deployment scenarios for Mycelium Chat homeservers, from development testing to production federation. The system is designed for easy deployment across multiple platforms while maintaining security and reliability.

## Prerequisites

### System Requirements

#### Minimum Requirements
- **CPU**: 2 cores, 2.0 GHz
- **RAM**: 2GB available memory
- **Storage**: 20GB free space
- **Network**: Stable internet connection (1 Mbps up/down)
- **OS**: Linux, Windows 10+, macOS 10.15+

#### Recommended Requirements
- **CPU**: 4 cores, 2.5 GHz
- **RAM**: 4GB available memory
- **Storage**: 100GB SSD
- **Network**: High-speed connection (10+ Mbps up/down)
- **OS**: Recent stable versions

#### Large Scale Requirements (1000+ users)
- **CPU**: 8+ cores, 3.0 GHz
- **RAM**: 8GB+ available memory
- **Storage**: 500GB+ SSD
- **Network**: Dedicated connection (100+ Mbps)
- **Monitoring**: Prometheus/Grafana setup

### Software Dependencies

#### Core Dependencies (Auto-installed)
- Matrix homeserver (Synapse or Dendrite)
- Mycelium daemon
- Matrix-Mycelium bridge
- TF Connect authentication module
- Discovery service

#### Optional Dependencies
- Docker (for containerized deployment)
- Reverse proxy (Nginx/Caddy for custom domains)
- Monitoring tools (Prometheus, Grafana)
- Backup tools (restic, borgbackup)

## Deployment Options

### Option 1: ThreeFold Grid Deployment

#### Benefits
- Decentralized infrastructure aligned with project values
- Pay with TFT tokens
- Global node availability
- Automatic scaling options

#### Prerequisites
- TFT tokens for payment
- ThreeFold Connect account
- Basic TF Grid knowledge

#### Deployment Steps

1. **Access TF Grid Dashboard**
   ```
   Navigate to: https://dashboard.grid.tf
   Login with ThreeFold Connect
   ```

2. **Deploy Mycelium Chat Solution**
   ```
   Go to: Applications → Mycelium Chat Homeserver
   Configure:
   - Node selection (region preference)
   - Resource allocation (CPU, RAM, Storage)
   - Domain name (optional)
   - TF Connect app ID
   ```

3. **Configuration**
   ```yaml
   # Auto-generated configuration
   homeserver:
     server_name: "matrix1.threefold.pro"
     public_baseurl: "https://matrix1.threefold.pro"
   
   mycelium:
     peers: ["auto-discover"]
     topics: ["matrix.federation", "matrix.discovery"]
   
   tf_connect:
     app_id: "chat.threefold.pro"
     auth_url: "https://login.threefold.me"
   ```

4. **DNS Configuration** (if using custom domain)
   ```
   A record: matrix1.yourdomain.com → [TF Grid VM IP]
   CNAME: _matrix._tcp.yourdomain.com → matrix1.yourdomain.com
   ```

5. **Verification**
   ```bash
   # Check homeserver status
   curl https://matrix1.threefold.pro/_matrix/client/versions
   
   # Verify federation
   curl https://matrix1.threefold.pro/_matrix/federation/v1/version
   ```

#### Cost Estimation
- **Small** (1-100 users): 100-300 TFT/month
- **Medium** (100-1000 users): 300-800 TFT/month
- **Large** (1000+ users): 800+ TFT/month

### Option 2: Personal Computer Deployment

#### Benefits
- Full control over hardware and data
- No ongoing hosting costs
- Learning opportunity
- Suitable for home/office use

#### Prerequisites
- Always-on computer
- Stable internet connection
- Administrative access
- Basic technical skills

#### Windows Deployment

1. **Download Installer**
   ```
   Download: mycelium-chat-homeserver-windows-x64.msi
   From: https://github.com/threefoldtech/mycelium-matrix/releases
   ```

2. **Installation**
   ```
   Right-click installer → "Run as Administrator"
   Follow installation wizard:
   - Accept license agreement
   - Choose installation directory
   - Configure basic settings
   - Install Windows services
   ```

3. **Configuration**
   ```
   Configuration file: C:\Program Files\Mycelium Chat\config.yaml
   
   homeserver:
     server_name: "your-computer.local"
     database_url: "sqlite:///C:/ProgramData/MyceliumChat/homeserver.db"
   
   mycelium:
     private_key_file: "C:/ProgramData/MyceliumChat/mycelium.key"
     peers: ["auto-discover"]
   
   tf_connect:
     app_id: "chat.threefold.pro"
   ```

4. **Service Management**
   ```cmd
   # Start services
   net start MyceliumChatHomeserver
   net start MyceliumDaemon
   
   # Check status
   sc query MyceliumChatHomeserver
   
   # View logs
   type "C:\ProgramData\MyceliumChat\logs\homeserver.log"
   ```

#### macOS Deployment

1. **Download Installer**
   ```bash
   # Download DMG package
   curl -L -o mycelium-chat-homeserver.dmg \
     https://github.com/threefoldtech/mycelium-matrix/releases/download/v1.0/mycelium-chat-homeserver-macos.dmg
   ```

2. **Installation**
   ```bash
   # Mount and install
   hdiutil mount mycelium-chat-homeserver.dmg
   sudo installer -pkg "/Volumes/Mycelium Chat/Mycelium Chat Homeserver.pkg" -target /
   ```

3. **Configuration**
   ```yaml
   # Configuration file: /usr/local/etc/mycelium-chat/config.yaml
   homeserver:
     server_name: "your-mac.local"
     database_url: "sqlite:////usr/local/var/mycelium-chat/homeserver.db"
   
   mycelium:
     private_key_file: "/usr/local/var/mycelium-chat/mycelium.key"
     peers: ["auto-discover"]
   ```

4. **Service Management**
   ```bash
   # Start services
   sudo launchctl load /Library/LaunchDaemons/io.threefold.mycelium-chat.plist
   
   # Check status
   sudo launchctl list | grep mycelium-chat
   
   # View logs
   tail -f /usr/local/var/log/mycelium-chat/homeserver.log
   ```

#### Linux Deployment

1. **Package Installation**
   ```bash
   # Ubuntu/Debian
   wget https://github.com/threefoldtech/mycelium-matrix/releases/download/v1.0/mycelium-chat-homeserver_1.0_amd64.deb
   sudo dpkg -i mycelium-chat-homeserver_1.0_amd64.deb
   sudo apt-get install -f  # Fix dependencies if needed
   
   # RHEL/CentOS
   wget https://github.com/threefoldtech/mycelium-matrix/releases/download/v1.0/mycelium-chat-homeserver-1.0.x86_64.rpm
   sudo rpm -i mycelium-chat-homeserver-1.0.x86_64.rpm
   ```

2. **Configuration**
   ```yaml
   # Configuration file: /etc/mycelium-chat/config.yaml
   homeserver:
     server_name: "your-server.local"
     database_url: "postgresql://mycelium:password@localhost/mycelium_chat"
   
   mycelium:
     private_key_file: "/var/lib/mycelium-chat/mycelium.key"
     peers: ["auto-discover"]
   ```

3. **Service Management**
   ```bash
   # Enable and start services
   sudo systemctl enable mycelium-chat-homeserver
   sudo systemctl start mycelium-chat-homeserver
   
   # Check status
   sudo systemctl status mycelium-chat-homeserver
   
   # View logs
   sudo journalctl -u mycelium-chat-homeserver -f
   ```

### Option 3: VPS/Cloud Deployment

#### Benefits
- Professional hosting environment
- Predictable performance and uptime
- Scalability options
- Global availability

#### Prerequisites
- VPS account (DigitalOcean, Linode, AWS, etc.)
- Domain name (recommended)
- SSH access
- Basic server administration skills

#### Deployment Steps

1. **Server Provisioning**
   ```bash
   # Recommended VPS specs
   CPU: 2+ cores
   RAM: 4GB+
   Storage: 50GB+ SSD
   OS: Ubuntu 22.04 LTS
   ```

2. **Initial Server Setup**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install dependencies
   sudo apt install -y curl wget gnupg2 software-properties-common
   
   # Create mycelium user
   sudo useradd -m -s /bin/bash mycelium
   sudo usermod -aG sudo mycelium
   ```

3. **Install Mycelium Chat**
   ```bash
   # Download and run installer
   curl -fsSL https://install.mycelium-chat.threefold.pro | sudo bash
   
   # Or manual installation
   wget https://github.com/threefoldtech/mycelium-matrix/releases/download/v1.0/install.sh
   chmod +x install.sh
   sudo ./install.sh
   ```

4. **Domain Configuration**
   ```bash
   # Configure domain in config file
   sudo nano /etc/mycelium-chat/config.yaml
   
   # Update server_name
   homeserver:
     server_name: "matrix.yourdomain.com"
     public_baseurl: "https://matrix.yourdomain.com"
   ```

5. **SSL Certificate Setup**
   ```bash
   # Install Certbot
   sudo apt install certbot python3-certbot-nginx
   
   # Get SSL certificate
   sudo certbot --nginx -d matrix.yourdomain.com
   
   # Auto-renewal
   sudo crontab -e
   # Add: 0 12 * * * /usr/bin/certbot renew --quiet
   ```

6. **Firewall Configuration**
   ```bash
   # Configure UFW
   sudo ufw allow ssh
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw allow 8448  # Matrix federation port
   sudo ufw enable
   ```

## Docker Deployment

### Benefits
- Consistent environment across platforms
- Easy updates and rollbacks
- Isolation and security
- Development and testing

### Docker Compose Setup

1. **Create Directory Structure**
   ```bash
   mkdir mycelium-chat
   cd mycelium-chat
   mkdir data config logs
   ```

2. **Docker Compose Configuration**
   ```yaml
   # docker-compose.yml
   version: '3.8'
   
   services:
     homeserver:
       image: threefoldtech/mycelium-matrix-homeserver:latest
       container_name: mycelium-homeserver
       restart: unless-stopped
       ports:
         - "8008:8008"
         - "8448:8448"
       volumes:
         - ./config:/config
         - ./data:/data
         - ./logs:/logs
       environment:
         - SERVER_NAME=matrix.yourdomain.com
         - TF_CONNECT_APP_ID=chat.threefold.pro
       depends_on:
         - postgres
         - mycelium
   
     mycelium:
       image: threefoldtech/mycelium:latest
       container_name: mycelium-daemon
       restart: unless-stopped
       network_mode: host
       volumes:
         - ./config/mycelium:/config
       command: ["--config", "/config/mycelium.toml"]
   
     postgres:
       image: postgres:15
       container_name: mycelium-postgres
       restart: unless-stopped
       environment:
         - POSTGRES_DB=mycelium_chat
         - POSTGRES_USER=mycelium
         - POSTGRES_PASSWORD=secure_password_here
       volumes:
         - ./data/postgres:/var/lib/postgresql/data
   
     nginx:
       image: nginx:alpine
       container_name: mycelium-nginx
       restart: unless-stopped
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - ./config/nginx:/etc/nginx/conf.d
         - ./data/ssl:/etc/ssl/certs
       depends_on:
         - homeserver
   ```

3. **Start Services**
   ```bash
   # Start all services
   docker-compose up -d
   
   # Check status
   docker-compose ps
   
   # View logs
   docker-compose logs -f homeserver
   ```

## Configuration Management

### Core Configuration Files

#### Main Configuration
```yaml
# config.yaml
homeserver:
  server_name: "matrix.yourdomain.com"
  public_baseurl: "https://matrix.yourdomain.com"
  database_url: "postgresql://user:pass@localhost/mycelium_chat"
  signing_key_path: "/path/to/signing.key"
  
mycelium:
  private_key_file: "/path/to/mycelium.key"
  peers: ["auto-discover"]
  topics:
    - "matrix.federation"
    - "matrix.discovery"
  listen_addresses:
    - "tcp://0.0.0.0:9651"
    - "quic://0.0.0.0:9651"

tf_connect:
  app_id: "chat.threefold.pro"
  auth_url: "https://login.threefold.me"
  callback_url: "https://matrix.yourdomain.com/_matrix/client/r0/login/tf_connect/callback"

federation:
  auto_discovery: true
  max_servers: 100
  health_check_interval: 300

logging:
  level: "INFO"
  file: "/var/log/mycelium-chat/homeserver.log"
  max_size: "100MB"
  max_files: 10
```

#### Environment-Specific Configuration
```bash
# .env file for Docker deployment
SERVER_NAME=matrix.yourdomain.com
PUBLIC_BASEURL=https://matrix.yourdomain.com
DATABASE_URL=postgresql://mycelium:password@postgres:5432/mycelium_chat
TF_CONNECT_APP_ID=chat.threefold.pro
LOG_LEVEL=INFO
```

### Security Configuration

#### SSL/TLS Setup
```nginx
# nginx configuration
server {
    listen 443 ssl http2;
    server_name matrix.yourdomain.com;
    
    ssl_certificate /etc/ssl/certs/matrix.yourdomain.com.crt;
    ssl_certificate_key /etc/ssl/private/matrix.yourdomain.com.key;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    
    # Matrix client API
    location /_matrix {
        proxy_pass http://127.0.0.1:8008;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
    }
    
    # Matrix federation
    location /_matrix/federation {
        proxy_pass http://127.0.0.1:8448;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
    }
}
```

#### Firewall Rules
```bash
# iptables rules
# Allow SSH
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow Matrix federation
iptables -A INPUT -p tcp --dport 8448 -j ACCEPT

# Allow Mycelium P2P
iptables -A INPUT -p tcp --dport 9651 -j ACCEPT
iptables -A INPUT -p udp --dport 9651 -j ACCEPT

# Drop all other incoming
iptables -A INPUT -j DROP
```

## Monitoring and Maintenance

### Health Monitoring
```bash
# Health check script
#!/bin/bash
# check-health.sh

# Check homeserver status
curl -f http://localhost:8008/_matrix/client/versions > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Homeserver: OK"
else
    echo "❌ Homeserver: FAILED"
fi

# Check Mycelium daemon
pgrep mycelium > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Mycelium: OK"
else
    echo "❌ Mycelium: FAILED"
fi

# Check federation connectivity
curl -f http://localhost:8448/_matrix/federation/v1/version > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Federation: OK"
else
    echo "❌ Federation: FAILED"
fi
```

### Backup Strategy
```bash
# Backup script
#!/bin/bash
# backup.sh

BACKUP_DIR="/backup/mycelium-chat"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR/$DATE"

# Backup database
pg_dump mycelium_chat > "$BACKUP_DIR/$DATE/database.sql"

# Backup configuration
cp -r /etc/mycelium-chat "$BACKUP_DIR/$DATE/config"

# Backup media files
cp -r /var/lib/mycelium-chat/media "$BACKUP_DIR/$DATE/media"

# Backup signing keys
cp /var/lib/mycelium-chat/signing.key "$BACKUP_DIR/$DATE/"

# Compress backup
tar -czf "$BACKUP_DIR/mycelium-chat-$DATE.tar.gz" -C "$BACKUP_DIR" "$DATE"
rm -rf "$BACKUP_DIR/$DATE"

# Clean old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
```

### Update Procedures
```bash
# Update script
#!/bin/bash
# update.sh

# Stop services
sudo systemctl stop mycelium-chat-homeserver

# Backup current installation
./backup.sh

# Download new version
wget https://github.com/threefoldtech/mycelium-matrix/releases/download/latest/mycelium-chat-homeserver.deb

# Install update
sudo dpkg -i mycelium-chat-homeserver.deb

# Restart services
sudo systemctl start mycelium-chat-homeserver

# Verify update
./check-health.sh
```

## Troubleshooting

### Common Issues

#### Federation Not Working
```bash
# Check federation port
sudo netstat -tlnp | grep :8448

# Test federation connectivity
curl https://matrix.yourdomain.com/_matrix/federation/v1/version

# Check Mycelium connectivity
mycelium-cli peers list
```

#### TF Connect Authentication Failing
```bash
# Check TF Connect configuration
grep -r "tf_connect" /etc/mycelium-chat/

# Verify app ID registration
curl "https://login.threefold.me/api/apps/chat.threefold.pro"

# Check authentication logs
grep "tf_connect" /var/log/mycelium-chat/homeserver.log
```

#### Performance Issues
```bash
# Check resource usage
htop
df -h
iostat -x 1

# Check database performance
sudo -u postgres psql mycelium_chat -c "SELECT * FROM pg_stat_activity;"

# Optimize database
sudo -u postgres psql mycelium_chat -c "VACUUM ANALYZE;"
```

### Log Analysis
```bash
# View real-time logs
tail -f /var/log/mycelium-chat/homeserver.log

# Search for errors
grep -i error /var/log/mycelium-chat/homeserver.log

# Analyze federation issues
grep -i federation /var/log/mycelium-chat/homeserver.log | tail -50
```

### Recovery Procedures
```bash
# Restore from backup
#!/bin/bash
# restore.sh

BACKUP_FILE="$1"
if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.tar.gz>"
    exit 1
fi

# Stop services
sudo systemctl stop mycelium-chat-homeserver

# Extract backup
tar -xzf "$BACKUP_FILE" -C /tmp/

# Restore database
sudo -u postgres dropdb mycelium_chat
sudo -u postgres createdb mycelium_chat
sudo -u postgres psql mycelium_chat < /tmp/*/database.sql

# Restore configuration
sudo cp -r /tmp/*/config/* /etc/mycelium-chat/

# Restore keys
sudo cp /tmp/*/signing.key /var/lib/mycelium-chat/

# Start services
sudo systemctl start mycelium-chat-homeserver

# Verify restoration
./check-health.sh
```

## Production Checklist

### Pre-Deployment
- [ ] Hardware/VPS meets minimum requirements
- [ ] Domain name configured and DNS propagated
- [ ] SSL certificate obtained and installed
- [ ] Firewall rules configured
- [ ] Backup strategy implemented
- [ ] Monitoring setup completed

### Post-Deployment
- [ ] Health checks passing
- [ ] Federation connectivity verified
- [ ] TF Connect authentication working
- [ ] User registration tested
- [ ] Cross-server messaging tested
- [ ] Backup restoration tested
- [ ] Update procedures documented

### Security Hardening
- [ ] SSH key-based authentication only
- [ ] Fail2ban configured
- [ ] Regular security updates scheduled
- [ ] Log monitoring implemented
- [ ] Intrusion detection configured
- [ ] Security audit completed

### Performance Optimization
- [ ] Database tuning completed
- [ ] Caching configured
- [ ] CDN setup for media files
- [ ] Load balancing implemented (if needed)
- [ ] Performance monitoring active
- [ ] Capacity planning documented
