# Multi-Server Federation Guide

Complete guide for deploying and managing a multi-server Mycelium Chat federation.

## Overview

Multi-server federation enables horizontal scaling and redundancy by distributing Matrix homeservers across multiple machines that communicate via Mycelium P2P networking. This architecture provides:

- **High Availability**: Service continues if individual servers fail
- **Load Distribution**: Users spread across multiple homeservers
- **Geographic Distribution**: Servers can be located worldwide
- **Decentralized Governance**: Different operators can run their own servers

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Server A      │    │   Server B      │    │   Server C      │
│  (Primary)      │    │  (Secondary)    │    │  (Secondary)    │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ Matrix Synapse  │    │ Matrix Synapse  │    │ Matrix Synapse  │
│ TF Connect Auth │    │ TF Connect Auth │    │ TF Connect Auth │
│ Bridge Service  │    │ Bridge Service  │    │ Bridge Service  │
│ Discovery Svc   │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Mycelium P2P    │
                    │ Network         │
                    └─────────────────┘
```

**Key Components:**
- **Primary Server**: Runs discovery service and initial user registration
- **Secondary Servers**: Additional homeservers for load distribution
- **Shared Discovery**: All servers register with the discovery service
- **P2P Federation**: All communication via Mycelium encrypted network

## Planning Your Federation

### Server Roles

**Primary Server (Required: 1):**
- Runs discovery service
- Handles initial user registration
- Manages federation coordination
- Typically the most powerful server

**Secondary Servers (Optional: 1-N):**
- Handle user load distribution
- Provide redundancy and failover
- Can be smaller/cheaper instances
- Register with primary discovery service

**Load Balancer (Optional):**
- Distributes new users across servers
- Provides single entry point
- Can be simple DNS round-robin or sophisticated

### Capacity Planning

**Small Federation (100-500 users):**
- 1 Primary server (4 CPU, 8GB RAM)
- 1-2 Secondary servers (2 CPU, 4GB RAM)
- Shared PostgreSQL or individual SQLite

**Medium Federation (500-2000 users):**
- 1 Primary server (8 CPU, 16GB RAM)
- 3-5 Secondary servers (4 CPU, 8GB RAM)
- Dedicated PostgreSQL cluster
- Redis for caching

**Large Federation (2000+ users):**
- 1-2 Primary servers (16 CPU, 32GB RAM)
- 5-10 Secondary servers (8 CPU, 16GB RAM)
- PostgreSQL cluster with replication
- Redis cluster
- Monitoring and alerting infrastructure

## Deployment Process

### Phase 1: Primary Server Setup

1. **Deploy Primary Server** following [Single Server Guide](./single-server.md)
2. **Enable Discovery Service** with external access
3. **Configure Load Balancing** for new user distribution
4. **Test Basic Functionality** before adding secondary servers

### Phase 2: Secondary Server Deployment

For each secondary server:

1. **Deploy Base System** using automated installer
2. **Configure Federation** to connect to primary
3. **Register with Discovery** service
4. **Test Federation** between servers
5. **Add to Load Balancer** rotation

### Phase 3: Federation Testing

1. **Cross-Server Messaging** between users on different servers
2. **Room Federation** with users from multiple servers
3. **Load Testing** with simulated user activity
4. **Failover Testing** by stopping individual servers

## Primary Server Configuration

### Discovery Service Setup

Edit `/etc/mycelium-chat/discovery.toml`:

```toml
[server]
bind_address = "0.0.0.0"  # Accept external connections
port = 3000
max_servers = 100
public_url = "https://discovery.chat.example.com"

[cleanup]
interval_seconds = 300     # 5 minutes
stale_threshold_minutes = 15

[persistence]
enabled = true
file_path = "/var/lib/mycelium-chat/discovery.json"
save_interval_seconds = 60

[security]
require_auth = false       # Or implement API key auth
rate_limit_per_minute = 100

[logging]
level = "info"
file = "/var/log/mycelium-chat/discovery.log"
```

### Load Balancer Configuration

**Option 1: DNS Round Robin**
```bash
# Configure multiple A records
chat.example.com.    300    IN    A    192.168.1.10  # Server A
chat.example.com.    300    IN    A    192.168.1.11  # Server B
chat.example.com.    300    IN    A    192.168.1.12  # Server C
```

**Option 2: Nginx Load Balancer**
```nginx
upstream mycelium_chat_servers {
    least_conn;
    server 192.168.1.10:8008 weight=3;  # Primary server
    server 192.168.1.11:8008 weight=2;  # Secondary server
    server 192.168.1.12:8008 weight=2;  # Secondary server
}

server {
    listen 443 ssl http2;
    server_name chat.example.com;
    
    ssl_certificate /etc/letsencrypt/live/chat.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chat.example.com/privkey.pem;
    
    location / {
        proxy_pass http://mycelium_chat_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Option 3: HAProxy Load Balancer**
```
global
    daemon
    
defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms
    
frontend mycelium_chat_frontend
    bind *:443 ssl crt /etc/ssl/certs/chat.example.com.pem
    default_backend mycelium_chat_backend
    
backend mycelium_chat_backend
    balance leastconn
    option httpchk GET /_matrix/client/versions
    server server-a 192.168.1.10:8008 check weight 3
    server server-b 192.168.1.11:8008 check weight 2
    server server-c 192.168.1.12:8008 check weight 2
```

## Secondary Server Configuration

### Automated Deployment

Use the installer with federation-specific configuration:

```bash
# Download installer
curl -L https://github.com/mik-tf/mycelium-chat/releases/latest/download/install.sh -o install.sh
chmod +x install.sh

# Run with federation mode
sudo ./install.sh --federation \
  --primary-server="https://chat.example.com" \
  --discovery-url="https://discovery.chat.example.com:3000" \
  --server-name="server-b.chat.example.com"
```

### Manual Configuration

Edit `/etc/mycelium-chat/homeserver.yaml`:

```yaml
# Server identification
server_name: "server-b.chat.example.com"

# Federation settings
federation_domain_whitelist:
  - "chat.example.com"
  - "server-a.chat.example.com"
  - "server-c.chat.example.com"

# Disable local discovery service (use primary)
discovery_service:
  enabled: false
  primary_url: "https://discovery.chat.example.com:3000"

# Bridge configuration
bridge:
  discovery_url: "https://discovery.chat.example.com:3000"
  register_on_startup: true
  server_info:
    name: "server-b.chat.example.com"
    capacity:
      max_users: 500
      current_users: 0
      available: true
    capabilities:
      - "federation"
      - "client"
    location: "Europe/Amsterdam"
    operator: "operator-b@example.com"
```

### Database Configuration

**Option 1: Shared PostgreSQL Cluster**
```yaml
database:
  name: psycopg2
  args:
    user: mycelium_server_b
    password: secure_password_here
    database: mycelium_chat_b
    host: postgres-cluster.example.com
    port: 5432
    cp_min: 5
    cp_max: 10
```

**Option 2: Individual Databases**
```yaml
database:
  name: psycopg2
  args:
    user: mycelium
    password: secure_password_here
    database: mycelium_chat
    host: localhost
    port: 5432
    cp_min: 5
    cp_max: 10
```

## Federation Management

### Server Registration

Each secondary server automatically registers with the discovery service:

```bash
# Check registration status
curl https://discovery.chat.example.com:3000/servers

# Manual registration (if needed)
curl -X POST https://discovery.chat.example.com:3000/servers/register \
  -H "Content-Type: application/json" \
  -d '{
    "server_name": "server-b.chat.example.com",
    "mycelium_address": "192.168.1.11:8080",
    "public_key": "server_b_public_key_here",
    "capabilities": ["federation", "client"],
    "capacity": {
      "max_users": 500,
      "current_users": 0,
      "available": true
    },
    "metadata": {
      "location": "Europe/Amsterdam",
      "operator": "operator-b@example.com",
      "version": "1.0.0"
    }
  }'
```

### User Distribution

**Automatic Distribution:**
The discovery service automatically selects servers based on:
- Available capacity (current_users < max_users)
- Server load (lowest current_users first)
- Geographic preference (if configured)
- Server capabilities

**Manual Assignment:**
Operators can assign users to specific servers:

```bash
# Create user on specific server
curl -X POST https://server-b.chat.example.com/_synapse/admin/v1/register \
  -H "Authorization: Bearer admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "password": "secure_password",
    "admin": false
  }'
```

### Cross-Server Communication

Users on different servers can communicate seamlessly:

1. **Room Creation**: Any user can create rooms
2. **Cross-Server Invites**: Invite users from any federated server
3. **Message Delivery**: Messages route via Mycelium P2P network
4. **Media Sharing**: Media files federate between servers
5. **Presence Sync**: User presence syncs across federation

## Monitoring Federation

### Discovery Service Monitoring

```bash
# Check registered servers
curl https://discovery.chat.example.com:3000/servers | jq '.'

# Get server statistics
curl https://discovery.chat.example.com:3000/stats | jq '.'

# Check specific server
curl https://discovery.chat.example.com:3000/servers/server-b.chat.example.com | jq '.'
```

### Federation Health Checks

```bash
# Test federation between servers
curl -X POST https://server-a.chat.example.com/_matrix/federation/v1/version \
  -H "Authorization: X-Matrix origin=server-b.chat.example.com,key=ed25519:1,sig=..."

# Check bridge connectivity
curl http://server-b.chat.example.com:8080/health

# Test Mycelium P2P connectivity
mycelium inspect --peer-id server-a-peer-id
```

### Performance Monitoring

**Key Metrics to Monitor:**
- **User Distribution**: Users per server
- **Message Throughput**: Messages/second per server
- **Federation Latency**: Cross-server message delivery time
- **Resource Usage**: CPU, memory, disk per server
- **Error Rates**: Failed federation attempts

**Monitoring Setup:**
```bash
# Prometheus configuration
# /etc/prometheus/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'mycelium-chat-servers'
    static_configs:
      - targets: 
        - 'server-a.chat.example.com:9090'
        - 'server-b.chat.example.com:9090'
        - 'server-c.chat.example.com:9090'
        
  - job_name: 'discovery-service'
    static_configs:
      - targets: ['discovery.chat.example.com:9091']
```

**Grafana Dashboard:**
- Server resource usage graphs
- User distribution charts
- Federation message flow
- Error rate alerts

## Scaling Operations

### Adding New Servers

1. **Deploy New Server** using automated installer
2. **Configure Federation** settings
3. **Register with Discovery** service
4. **Test Federation** with existing servers
5. **Add to Load Balancer** (if used)
6. **Monitor Integration** for 24-48 hours

### Removing Servers

1. **Stop New User Registration** on target server
2. **Migrate Existing Users** to other servers (optional)
3. **Drain Active Sessions** gracefully
4. **Unregister from Discovery** service
5. **Remove from Load Balancer**
6. **Backup Data** before shutdown
7. **Monitor Federation** after removal

### Load Rebalancing

**Automatic Rebalancing:**
The discovery service automatically directs new users to least-loaded servers.

**Manual Rebalancing:**
```bash
# Get current user distribution
for server in server-a server-b server-c; do
  echo "$server: $(curl -s https://$server.chat.example.com/_synapse/admin/v1/users | jq '.total')"
done

# Migrate users between servers (requires custom tooling)
./migrate-users.sh --from=server-a.chat.example.com --to=server-b.chat.example.com --users=100
```

## Backup and Recovery

### Federation-Wide Backup Strategy

**Distributed Backups:**
- Each server maintains its own backups
- Cross-server backup verification
- Centralized backup monitoring

**Backup Coordination:**
```bash
#!/bin/bash
# /usr/local/bin/federation-backup.sh

SERVERS=("server-a" "server-b" "server-c")
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)

for server in "${SERVERS[@]}"; do
  echo "Backing up $server..."
  
  # Trigger backup on remote server
  ssh mycelium@$server.chat.example.com "/usr/local/bin/backup-mycelium-chat.sh"
  
  # Copy backup to central location
  scp mycelium@$server.chat.example.com:/var/backups/mycelium-chat/db_*.sql \
    /central/backups/$server/db_$BACKUP_DATE.sql
    
  # Verify backup integrity
  if [ $? -eq 0 ]; then
    echo "✓ $server backup completed"
  else
    echo "✗ $server backup failed"
    # Send alert
  fi
done
```

### Disaster Recovery

**Single Server Failure:**
1. **Detect Failure** via monitoring
2. **Remove from Load Balancer** automatically
3. **Users Reconnect** to other servers
4. **Restore Server** from backup
5. **Re-add to Federation** after verification

**Multiple Server Failure:**
1. **Assess Scope** of failure
2. **Prioritize Recovery** (primary server first)
3. **Restore from Backups** in dependency order
4. **Verify Federation** connectivity
5. **Resume Normal Operations**

**Complete Federation Loss:**
1. **Restore Primary Server** first
2. **Restore Discovery Service** and data
3. **Restore Secondary Servers** one by one
4. **Verify Cross-Server** communication
5. **Restore User Access** and test functionality

## Security in Federation

### Network Security

**Firewall Configuration:**
```bash
# Allow federation ports between servers
sudo ufw allow from 192.168.1.0/24 to any port 8008  # Matrix federation
sudo ufw allow from 192.168.1.0/24 to any port 8080  # Bridge communication
sudo ufw allow from 192.168.1.0/24 to any port 3000  # Discovery service

# Allow Mycelium P2P
sudo ufw allow 9651/tcp   # Mycelium TCP
sudo ufw allow 9651/udp   # Mycelium UDP
```

**VPN/Private Networks:**
- Use VPN for server-to-server communication
- Private networks for database clusters
- Bastion hosts for administrative access

### Authentication Security

**Shared Secrets:**
- Use different registration secrets per server
- Rotate secrets regularly
- Secure secret distribution

**TLS Certificates:**
- Individual certificates per server
- Automated renewal coordination
- Certificate transparency monitoring

### Access Control

**Administrative Access:**
- Separate admin accounts per server
- Multi-factor authentication required
- Audit logging for all admin actions

**Federation Access:**
- Whitelist trusted servers
- Monitor federation attempts
- Rate limiting on federation endpoints

## Troubleshooting Federation

### Common Issues

**1. Server Not Appearing in Discovery:**
```bash
# Check registration
curl https://discovery.chat.example.com:3000/servers | grep server-name

# Check server connectivity
curl http://server-name:8080/health

# Check logs
tail -f /var/log/mycelium-chat/bridge.log | grep discovery
```

**2. Cross-Server Messages Not Delivering:**
```bash
# Check Mycelium connectivity
mycelium inspect

# Check bridge logs on both servers
tail -f /var/log/mycelium-chat/bridge.log | grep federation

# Test direct bridge communication
curl -X POST http://server-a:8080/test-federation \
  -d '{"target":"server-b","message":"test"}'
```

**3. User Cannot Join Cross-Server Room:**
```bash
# Check federation whitelist
grep federation_domain_whitelist /etc/mycelium-chat/homeserver.yaml

# Check room federation settings
curl https://server-a.chat.example.com/_matrix/client/r0/rooms/!room:server-a.com/state \
  -H "Authorization: Bearer user_token"

# Check server capabilities
curl https://discovery.chat.example.com:3000/servers/server-b.chat.example.com
```

**4. Load Balancer Issues:**
```bash
# Check server health from load balancer
curl -H "Host: chat.example.com" http://server-a:8008/_matrix/client/versions
curl -H "Host: chat.example.com" http://server-b:8008/_matrix/client/versions

# Check load balancer logs
tail -f /var/log/nginx/access.log | grep "_matrix"
tail -f /var/log/haproxy.log | grep mycelium_chat
```

### Performance Issues

**Uneven Load Distribution:**
```bash
# Check current user distribution
for server in server-a server-b server-c; do
  users=$(curl -s https://$server.chat.example.com/_synapse/admin/v1/users | jq '.total')
  echo "$server: $users users"
done

# Check discovery service selection algorithm
curl https://discovery.chat.example.com:3000/servers/select?debug=true

# Adjust server weights in load balancer
# Update capacity in discovery service registration
```

**High Federation Latency:**
```bash
# Test Mycelium P2P latency
mycelium ping peer-id-of-other-server

# Check bridge processing time
grep "processing_time" /var/log/mycelium-chat/bridge.log

# Monitor database performance
sudo -u postgres psql mycelium_chat -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
WHERE query LIKE '%federation%'
ORDER BY total_time DESC LIMIT 10;
"
```

## Best Practices

### Federation Design

1. **Start Small**: Begin with 2-3 servers, scale gradually
2. **Geographic Distribution**: Place servers in different regions
3. **Capacity Planning**: Plan for 2x expected load
4. **Redundancy**: Ensure no single point of failure
5. **Monitoring**: Comprehensive monitoring from day one

### Operational Practices

1. **Staged Deployments**: Test changes on secondary servers first
2. **Rolling Updates**: Update servers one at a time
3. **Backup Verification**: Regularly test backup restoration
4. **Documentation**: Keep runbooks updated
5. **Incident Response**: Have clear escalation procedures

### Security Practices

1. **Principle of Least Privilege**: Minimal required access
2. **Regular Updates**: Keep all components updated
3. **Security Monitoring**: Monitor for suspicious activity
4. **Access Auditing**: Regular access reviews
5. **Incident Response**: Security incident procedures

## Next Steps

After successful multi-server federation:

1. **Optimize Performance** based on monitoring data
2. **Implement Advanced Features** like geographic routing
3. **Scale Horizontally** by adding more servers
4. **Enhance Monitoring** with custom dashboards
5. **Build Community** around your federation

For advanced topics, see:
- [Monitoring and Troubleshooting Guide](./monitoring.md)
- [Performance Optimization Guide](./performance.md)
- [Security Hardening Guide](./security.md)
