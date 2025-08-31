# Monitoring and Troubleshooting Guide

Comprehensive monitoring, alerting, and troubleshooting guide for Mycelium Chat federation.

## Overview

Effective monitoring is critical for maintaining a healthy Mycelium Chat federation. This guide covers:

- **System Monitoring**: Server resources and performance
- **Application Monitoring**: Matrix, bridge, and discovery service metrics
- **Federation Monitoring**: Cross-server communication health
- **Alerting**: Proactive issue detection and notification
- **Troubleshooting**: Common issues and resolution procedures

## Monitoring Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Prometheus    │    │    Grafana      │    │   AlertManager  │
│   (Metrics)     │◄──►│  (Dashboards)   │◄──►│   (Alerts)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲                       │
         │                       │                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Node Exporters  │    │  Log Aggregation│    │  Notification   │
│ (System Metrics)│    │   (ELK Stack)   │    │   Channels      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲                       │
         │                       │                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Mycelium Chat Servers                        │
│  Matrix Synapse │ Bridge Service │ Discovery Service │ Mycelium │
└─────────────────────────────────────────────────────────────────┘
```

## Metrics Collection

### Prometheus Setup

**Install Prometheus:**
```bash
# Download and install
wget https://github.com/prometheus/prometheus/releases/latest/download/prometheus-linux-amd64.tar.gz
tar xvf prometheus-linux-amd64.tar.gz
sudo mv prometheus-*/prometheus /usr/local/bin/
sudo mv prometheus-*/promtool /usr/local/bin/

# Create user and directories
sudo useradd --no-create-home --shell /bin/false prometheus
sudo mkdir /etc/prometheus /var/lib/prometheus
sudo chown prometheus:prometheus /etc/prometheus /var/lib/prometheus
```

**Configure Prometheus (`/etc/prometheus/prometheus.yml`):**
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "mycelium_chat_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - localhost:9093

scrape_configs:
  # System metrics
  - job_name: 'node-exporter'
    static_configs:
      - targets:
        - 'server-a.chat.example.com:9100'
        - 'server-b.chat.example.com:9100'
        - 'server-c.chat.example.com:9100'

  # Matrix Synapse metrics
  - job_name: 'synapse'
    static_configs:
      - targets:
        - 'server-a.chat.example.com:9090'
        - 'server-b.chat.example.com:9090'
        - 'server-c.chat.example.com:9090'
    metrics_path: /_synapse/metrics

  # Bridge service metrics
  - job_name: 'mycelium-bridge'
    static_configs:
      - targets:
        - 'server-a.chat.example.com:8081'
        - 'server-b.chat.example.com:8081'
        - 'server-c.chat.example.com:8081'
    metrics_path: /metrics

  # Discovery service metrics
  - job_name: 'discovery-service'
    static_configs:
      - targets:
        - 'discovery.chat.example.com:3001'
    metrics_path: /metrics

  # PostgreSQL metrics (if using)
  - job_name: 'postgres'
    static_configs:
      - targets:
        - 'db-server.chat.example.com:9187'
```

### Node Exporter Setup

**Install on each server:**
```bash
# Download and install
wget https://github.com/prometheus/node_exporter/releases/latest/download/node_exporter-linux-amd64.tar.gz
tar xvf node_exporter-linux-amd64.tar.gz
sudo mv node_exporter-*/node_exporter /usr/local/bin/

# Create systemd service
sudo tee /etc/systemd/system/node_exporter.service << EOF
[Unit]
Description=Node Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF

# Start service
sudo useradd --no-create-home --shell /bin/false node_exporter
sudo systemctl daemon-reload
sudo systemctl enable node_exporter
sudo systemctl start node_exporter
```

### Application Metrics

**Synapse Metrics Configuration:**
```yaml
# homeserver.yaml
enable_metrics: true
listeners:
  - port: 9090
    type: metrics
    bind_addresses: ['0.0.0.0']
    resources: []
```

**Bridge Metrics (add to bridge code):**
```rust
// src/metrics.rs
use prometheus::{Counter, Histogram, Gauge, register_counter, register_histogram, register_gauge};

lazy_static! {
    static ref MESSAGES_TOTAL: Counter = register_counter!(
        "mycelium_bridge_messages_total",
        "Total number of messages processed"
    ).unwrap();
    
    static ref MESSAGE_LATENCY: Histogram = register_histogram!(
        "mycelium_bridge_message_latency_seconds",
        "Message processing latency"
    ).unwrap();
    
    static ref ACTIVE_CONNECTIONS: Gauge = register_gauge!(
        "mycelium_bridge_active_connections",
        "Number of active connections"
    ).unwrap();
}

// Expose metrics endpoint
async fn metrics_handler() -> Result<String, Box<dyn std::error::Error>> {
    use prometheus::Encoder;
    let encoder = prometheus::TextEncoder::new();
    let metric_families = prometheus::gather();
    Ok(encoder.encode_to_string(&metric_families)?)
}
```

**Discovery Service Metrics:**
```rust
// Add to discovery service
use prometheus::{Counter, Gauge, register_counter, register_gauge};

lazy_static! {
    static ref SERVERS_REGISTERED: Gauge = register_gauge!(
        "discovery_service_servers_registered",
        "Number of registered servers"
    ).unwrap();
    
    static ref REQUESTS_TOTAL: Counter = register_counter!(
        "discovery_service_requests_total",
        "Total number of requests"
    ).unwrap();
}
```

## Key Metrics to Monitor

### System Metrics

**CPU Usage:**
- `node_cpu_seconds_total` - CPU time per core
- `rate(node_cpu_seconds_total[5m])` - CPU usage rate
- Alert: >80% for 5 minutes

**Memory Usage:**
- `node_memory_MemAvailable_bytes` - Available memory
- `(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100` - Memory usage %
- Alert: >85% for 5 minutes

**Disk Usage:**
- `node_filesystem_avail_bytes` - Available disk space
- `(1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100` - Disk usage %
- Alert: >90% for any filesystem

**Network:**
- `rate(node_network_receive_bytes_total[5m])` - Network receive rate
- `rate(node_network_transmit_bytes_total[5m])` - Network transmit rate
- Alert: Unusual spikes or drops

### Application Metrics

**Matrix Synapse:**
- `synapse_http_requests_total` - HTTP request count
- `synapse_http_request_duration_seconds` - Request latency
- `synapse_federation_transactions_total` - Federation transactions
- `synapse_database_connections` - Database connections
- `synapse_background_process_ru_utime_seconds` - Background process CPU

**Bridge Service:**
- `mycelium_bridge_messages_total` - Messages processed
- `mycelium_bridge_message_latency_seconds` - Message latency
- `mycelium_bridge_active_connections` - Active connections
- `mycelium_bridge_errors_total` - Error count

**Discovery Service:**
- `discovery_service_servers_registered` - Registered servers
- `discovery_service_requests_total` - API requests
- `discovery_service_selection_latency` - Server selection time

### Federation Metrics

**Cross-Server Communication:**
- Message delivery success rate
- Cross-server latency
- Federation error rates
- Server availability

**User Distribution:**
- Users per server
- New user registration rate
- Active users per server

## Alerting Rules

### Prometheus Alert Rules (`/etc/prometheus/mycelium_chat_rules.yml`)

```yaml
groups:
  - name: mycelium_chat_system
    rules:
      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage on {{ $labels.instance }}"
          description: "CPU usage is above 80% for 5 minutes"

      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage on {{ $labels.instance }}"
          description: "Memory usage is above 85% for 5 minutes"

      - alert: DiskSpaceLow
        expr: (1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100 > 90
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Low disk space on {{ $labels.instance }}"
          description: "Disk usage is above 90%"

  - name: mycelium_chat_application
    rules:
      - alert: SynapseDown
        expr: up{job="synapse"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Synapse server down on {{ $labels.instance }}"
          description: "Synapse server has been down for more than 1 minute"

      - alert: BridgeDown
        expr: up{job="mycelium-bridge"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Bridge service down on {{ $labels.instance }}"
          description: "Bridge service has been down for more than 1 minute"

      - alert: HighErrorRate
        expr: rate(synapse_http_requests_total{code=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate on {{ $labels.instance }}"
          description: "HTTP 5xx error rate is above 10% for 5 minutes"

      - alert: DatabaseConnectionsHigh
        expr: synapse_database_connections > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database connections on {{ $labels.instance }}"
          description: "Database connections are above 80 for 5 minutes"

  - name: mycelium_chat_federation
    rules:
      - alert: DiscoveryServiceDown
        expr: up{job="discovery-service"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Discovery service is down"
          description: "Discovery service has been down for more than 1 minute"

      - alert: FederationLatencyHigh
        expr: histogram_quantile(0.95, rate(mycelium_bridge_message_latency_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High federation latency on {{ $labels.instance }}"
          description: "95th percentile federation latency is above 1 second"

      - alert: ServerNotRegistered
        expr: discovery_service_servers_registered < 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Low server count in discovery service"
          description: "Less than 2 servers registered with discovery service"
```

### AlertManager Configuration

**Install AlertManager:**
```bash
wget https://github.com/prometheus/alertmanager/releases/latest/download/alertmanager-linux-amd64.tar.gz
tar xvf alertmanager-linux-amd64.tar.gz
sudo mv alertmanager-*/alertmanager /usr/local/bin/
sudo mv alertmanager-*/amtool /usr/local/bin/
```

**Configure AlertManager (`/etc/alertmanager/alertmanager.yml`):**
```yaml
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@chat.example.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
    - match:
        severity: warning
      receiver: 'warning-alerts'

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://localhost:5001/'

  - name: 'critical-alerts'
    email_configs:
      - to: 'admin@chat.example.com'
        subject: 'CRITICAL: Mycelium Chat Alert'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          {{ end }}
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts'
        title: 'CRITICAL Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

  - name: 'warning-alerts'
    email_configs:
      - to: 'ops@chat.example.com'
        subject: 'WARNING: Mycelium Chat Alert'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          {{ end }}

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']
```

## Log Management

### Centralized Logging with ELK Stack

**Elasticsearch Setup:**
```bash
# Install Elasticsearch
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -
echo "deb https://artifacts.elastic.co/packages/7.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-7.x.list
sudo apt update && sudo apt install elasticsearch

# Configure Elasticsearch
sudo nano /etc/elasticsearch/elasticsearch.yml
# network.host: 0.0.0.0
# discovery.type: single-node

sudo systemctl enable elasticsearch
sudo systemctl start elasticsearch
```

**Logstash Configuration:**
```ruby
# /etc/logstash/conf.d/mycelium-chat.conf
input {
  beats {
    port => 5044
  }
}

filter {
  if [fields][service] == "synapse" {
    grok {
      match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} - %{WORD:logger} - %{LOGLEVEL:level} - %{GREEDYDATA:message}" }
    }
  }
  
  if [fields][service] == "bridge" {
    json {
      source => "message"
    }
  }
  
  date {
    match => [ "timestamp", "ISO8601" ]
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "mycelium-chat-%{+YYYY.MM.dd}"
  }
}
```

**Filebeat Configuration (on each server):**
```yaml
# /etc/filebeat/filebeat.yml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/mycelium-chat/synapse.log
    fields:
      service: synapse
    fields_under_root: true

  - type: log
    enabled: true
    paths:
      - /var/log/mycelium-chat/bridge.log
    fields:
      service: bridge
    fields_under_root: true

  - type: log
    enabled: true
    paths:
      - /var/log/mycelium-chat/discovery.log
    fields:
      service: discovery
    fields_under_root: true

output.logstash:
  hosts: ["log-server.chat.example.com:5044"]

processors:
  - add_host_metadata:
      when.not.contains.tags: forwarded
```

### Log Analysis Queries

**Common Kibana Queries:**
```
# Authentication failures
service:synapse AND level:ERROR AND message:"Authentication failed"

# Federation errors
service:bridge AND level:ERROR AND message:*federation*

# High latency messages
service:bridge AND processing_time:>1000

# Database connection errors
service:synapse AND message:*database* AND level:ERROR

# Discovery service issues
service:discovery AND level:ERROR
```

## Grafana Dashboards

### System Overview Dashboard

**Key Panels:**
- CPU usage by server
- Memory usage by server
- Disk usage by server
- Network I/O by server
- Load average by server

**Sample Panel Query:**
```promql
# CPU Usage
100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory Usage
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Disk Usage
(1 - (node_filesystem_avail_bytes{fstype!="tmpfs"} / node_filesystem_size_bytes)) * 100
```

### Application Dashboard

**Key Panels:**
- HTTP requests per second
- Request latency percentiles
- Error rate by endpoint
- Database connections
- Background process CPU

**Sample Panel Queries:**
```promql
# Request Rate
rate(synapse_http_requests_total[5m])

# Request Latency
histogram_quantile(0.95, rate(synapse_http_request_duration_seconds_bucket[5m]))

# Error Rate
rate(synapse_http_requests_total{code=~"5.."}[5m]) / rate(synapse_http_requests_total[5m]) * 100
```

### Federation Dashboard

**Key Panels:**
- Registered servers count
- Message throughput by server
- Federation latency
- Cross-server error rate
- User distribution

**Sample Panel Queries:**
```promql
# Registered Servers
discovery_service_servers_registered

# Message Throughput
rate(mycelium_bridge_messages_total[5m])

# Federation Latency
histogram_quantile(0.95, rate(mycelium_bridge_message_latency_seconds_bucket[5m]))
```

## Health Checks

### Automated Health Checks

**Health Check Script:**
```bash
#!/bin/bash
# /usr/local/bin/health-check.sh

SERVERS=("server-a" "server-b" "server-c")
DISCOVERY_URL="https://discovery.chat.example.com:3000"
ALERT_EMAIL="ops@chat.example.com"

check_service() {
    local server=$1
    local service=$2
    local port=$3
    local path=$4
    
    if curl -f -s "https://$server.chat.example.com:$port$path" > /dev/null; then
        echo "✓ $server $service is healthy"
        return 0
    else
        echo "✗ $server $service is unhealthy"
        return 1
    fi
}

check_federation() {
    local server1=$1
    local server2=$2
    
    # Test cross-server communication
    # This would require implementing a test endpoint
    if curl -f -s "https://$server1.chat.example.com:8080/test-federation?target=$server2" > /dev/null; then
        echo "✓ Federation between $server1 and $server2 is working"
        return 0
    else
        echo "✗ Federation between $server1 and $server2 is broken"
        return 1
    fi
}

# Check all services
failed_checks=0

for server in "${SERVERS[@]}"; do
    check_service "$server" "synapse" "8008" "/_matrix/client/versions" || ((failed_checks++))
    check_service "$server" "bridge" "8080" "/health" || ((failed_checks++))
done

check_service "discovery" "discovery" "3000" "/servers" || ((failed_checks++))

# Check federation between servers
for i in "${!SERVERS[@]}"; do
    for j in "${!SERVERS[@]}"; do
        if [ $i -ne $j ]; then
            check_federation "${SERVERS[$i]}" "${SERVERS[$j]}" || ((failed_checks++))
        fi
    done
done

# Send alert if any checks failed
if [ $failed_checks -gt 0 ]; then
    echo "Health check failed: $failed_checks issues found" | mail -s "Mycelium Chat Health Check Failed" "$ALERT_EMAIL"
    exit 1
else
    echo "All health checks passed"
    exit 0
fi
```

**Schedule Health Checks:**
```bash
# Add to crontab
*/5 * * * * /usr/local/bin/health-check.sh >> /var/log/mycelium-chat/health-check.log 2>&1
```

### Manual Health Verification

**Quick Health Check Commands:**
```bash
# Check all services are running
systemctl status mycelium-chat-*

# Check service endpoints
curl https://server-a.chat.example.com/_matrix/client/versions
curl http://server-a.chat.example.com:8080/health
curl https://discovery.chat.example.com:3000/servers

# Check database connectivity
psql -h localhost -U mycelium -d mycelium_chat -c "SELECT 1;"

# Check Mycelium P2P connectivity
mycelium inspect
```

## Troubleshooting Procedures

### Performance Issues

**High CPU Usage:**
1. **Identify Process**: `top`, `htop`, or `ps aux --sort=-%cpu`
2. **Check Logs**: Look for error patterns or excessive processing
3. **Database Performance**: Check slow queries and optimize
4. **Scale Resources**: Add CPU cores or distribute load

**High Memory Usage:**
1. **Memory Analysis**: `free -h`, `ps aux --sort=-%mem`
2. **Check for Leaks**: Monitor memory growth over time
3. **Adjust Caches**: Reduce Synapse cache sizes if needed
4. **Scale Resources**: Add RAM or optimize application

**Database Issues:**
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check slow queries
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY total_time DESC LIMIT 10;

-- Check database size
SELECT pg_size_pretty(pg_database_size('mycelium_chat'));

-- Vacuum and analyze
VACUUM ANALYZE;
```

### Federation Issues

**Server Not Federating:**
1. **Check Registration**: Verify server is registered with discovery service
2. **Network Connectivity**: Test Mycelium P2P connectivity
3. **Bridge Logs**: Check for federation errors
4. **Firewall Rules**: Ensure required ports are open

**Message Delivery Issues:**
1. **Check Bridge Status**: Verify bridge is running and healthy
2. **Mycelium Connectivity**: Test P2P network connectivity
3. **Message Queue**: Check for message backlog
4. **Cross-Server Test**: Send test messages between servers

**Discovery Service Issues:**
1. **Service Status**: Check if discovery service is running
2. **Server Registration**: Verify servers can register
3. **Database Persistence**: Check if server data is being saved
4. **API Endpoints**: Test all discovery service endpoints

### Application Errors

**Synapse Startup Issues:**
```bash
# Check configuration syntax
python3 -m synapse.app.homeserver --config-path /etc/mycelium-chat/homeserver.yaml --generate-config

# Check database connectivity
sudo -u mycelium-chat psql -h localhost -U mycelium -d mycelium_chat -c "SELECT 1;"

# Check file permissions
sudo chown -R mycelium-chat:mycelium-chat /var/lib/mycelium-chat/
sudo chmod 600 /etc/mycelium-chat/homeserver.yaml

# Check logs for specific errors
tail -f /var/log/mycelium-chat/synapse.log
```

**Authentication Issues:**
```bash
# Check TF Connect configuration
grep -A 10 "tf_connect" /etc/mycelium-chat/homeserver.yaml

# Test TF Connect API connectivity
curl -v "https://login.threefold.me/api/users/me"

# Check auth provider installation
python3 -c "import synapse_tf_connect; print('Auth provider installed')"

# Check auth logs
grep "tf_connect" /var/log/mycelium-chat/synapse.log | tail -20
```

## Incident Response

### Incident Classification

**Severity Levels:**
- **Critical**: Service completely unavailable
- **High**: Major functionality impaired
- **Medium**: Minor functionality issues
- **Low**: Cosmetic or documentation issues

### Response Procedures

**Critical Incidents:**
1. **Immediate Response** (within 15 minutes)
2. **Stakeholder Notification** (within 30 minutes)
3. **Status Page Update** (within 30 minutes)
4. **Resolution Efforts** (continuous)
5. **Post-Incident Review** (within 48 hours)

**Escalation Matrix:**
- **Level 1**: On-call engineer
- **Level 2**: Senior engineer + team lead
- **Level 3**: Engineering manager + operations manager
- **Level 4**: CTO + executive team

### Communication Templates

**Initial Alert:**
```
INCIDENT: [SEVERITY] - [BRIEF DESCRIPTION]
Time: [TIMESTAMP]
Impact: [USER IMPACT DESCRIPTION]
Status: Investigating
ETA: [ESTIMATED RESOLUTION TIME]
Updates: Every 30 minutes or as significant progress is made
```

**Status Update:**
```
INCIDENT UPDATE: [BRIEF DESCRIPTION]
Time: [TIMESTAMP]
Status: [INVESTIGATING/IDENTIFIED/MONITORING/RESOLVED]
Progress: [WHAT HAS BEEN DONE]
Next Steps: [WHAT WILL BE DONE NEXT]
ETA: [UPDATED ESTIMATE]
```

**Resolution Notice:**
```
INCIDENT RESOLVED: [BRIEF DESCRIPTION]
Time: [TIMESTAMP]
Duration: [TOTAL INCIDENT TIME]
Root Cause: [BRIEF ROOT CAUSE]
Resolution: [WHAT WAS DONE TO RESOLVE]
Prevention: [STEPS TO PREVENT RECURRENCE]
Post-Mortem: [LINK TO DETAILED ANALYSIS]
```

## Performance Optimization

### Monitoring-Driven Optimization

**Identify Bottlenecks:**
1. **CPU Hotspots**: Use profiling tools to identify high-CPU functions
2. **Memory Leaks**: Monitor memory growth patterns
3. **Database Queries**: Identify slow or frequent queries
4. **Network Latency**: Measure cross-server communication times

**Optimization Strategies:**
1. **Database Tuning**: Optimize queries, add indexes, tune configuration
2. **Caching**: Implement or tune application caches
3. **Load Balancing**: Distribute load more evenly across servers
4. **Resource Scaling**: Add CPU, memory, or storage as needed

**Performance Testing:**
```bash
# Run performance tests
cd tests/integration
./test_runner.sh --performance

# Load testing with custom tools
./load-test.sh --users=1000 --duration=300s --servers=3

# Database performance testing
pgbench -h localhost -U mycelium -d mycelium_chat -c 10 -j 2 -T 60
```

This comprehensive monitoring and troubleshooting guide provides the foundation for maintaining a healthy and performant Mycelium Chat federation. Regular monitoring, proactive alerting, and systematic troubleshooting procedures ensure reliable service for all users.
