# Technical Specifications

## Matrix-Mycelium Bridge

### Overview
The Matrix-Mycelium bridge is the core component that enables Matrix homeservers to federate over the Mycelium P2P network instead of traditional HTTP. This bridge translates Matrix federation events into Mycelium messages and handles routing between homeservers.

### Architecture

#### Component Structure
```
┌─────────────────────────────────────────────────────────────┐
│                Matrix Homeserver                            │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │ Matrix Core     │    │ Federation Sender/Receiver      │ │
│  │ (Synapse/       │◄──►│ (Modified for Mycelium)         │ │
│  │  Dendrite)      │    │                                 │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────┬───────────────────────────┘
                                  │ HTTP API calls
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                Matrix-Mycelium Bridge                       │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │ HTTP Server     │    │ Message Translator              │ │
│  │ (Receives       │◄──►│ (Matrix ↔ Mycelium)            │ │
│  │  Matrix calls)  │    │                                 │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │ Discovery       │    │ Routing Engine                  │ │
│  │ Service         │◄──►│ (Server lookup & delivery)      │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────┬───────────────────────────┘
                                  │ Mycelium API calls
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  Mycelium Daemon                            │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │ HTTP API        │    │ P2P Network Stack               │ │
│  │ (localhost:8989)│◄──►│ (IPv6 overlay, routing)         │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### API Specifications

#### Bridge HTTP API

**Base URL**: `http://localhost:8080` (internal bridge API)

##### Send Federation Event
```http
POST /federation/send
Content-Type: application/json

{
  "destination": "matrix2.threefold.pro",
  "event_type": "m.room.message",
  "event_data": {
    "type": "m.room.message",
    "sender": "@alice:matrix1.threefold.pro",
    "room_id": "!roomid:matrix1.threefold.pro",
    "content": {
      "msgtype": "m.text",
      "body": "Hello from Matrix over Mycelium!"
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "message_id": "msg_123456789",
  "delivery_status": "sent"
}
```

##### Query Server Directory
```http
GET /federation/servers
```

**Response**:
```json
{
  "servers": [
    {
      "server_name": "matrix1.threefold.pro",
      "mycelium_address": "400:8f3b:7c2a:1d4e:9a6f:2b8c:5e1a:3f7d",
      "last_seen": "2025-08-30T21:27:00Z",
      "status": "online",
      "capacity": {
        "max_users": 1000,
        "current_users": 47
      }
    }
  ]
}
```

##### Health Check
```http
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "mycelium_connected": true,
  "matrix_connected": true,
  "federation_active": true,
  "uptime": 86400
}
```

#### Mycelium Integration

##### Message Topics
```
matrix.federation.{destination_server}  # Direct server-to-server messages
matrix.discovery                        # Server announcements and discovery
matrix.broadcast                        # Network-wide announcements
```

##### Message Format
```json
{
  "version": "1.0",
  "source_server": "matrix1.threefold.pro",
  "destination_server": "matrix2.threefold.pro",
  "message_type": "federation_event",
  "timestamp": "2025-08-30T21:27:00Z",
  "payload": {
    "event_type": "m.room.message",
    "event_data": { /* Matrix event JSON */ }
  },
  "signature": "ed25519_signature_here"
}
```

### Implementation Details

#### Rust Bridge Service

**Dependencies**:
```toml
[dependencies]
tokio = { version = "1.0", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
reqwest = { version = "0.11", features = ["json"] }
tracing = "0.1"
tracing-subscriber = "0.3"
ed25519-dalek = "2.0"
uuid = { version = "1.0", features = ["v4"] }
```

**Core Service Structure**:
```rust
use tokio::net::TcpListener;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct BridgeConfig {
    pub matrix_homeserver_url: String,
    pub mycelium_api_url: String,
    pub server_name: String,
    pub signing_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FederationEvent {
    pub destination: String,
    pub event_type: String,
    pub event_data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MyceliumMessage {
    pub version: String,
    pub source_server: String,
    pub destination_server: String,
    pub message_type: String,
    pub timestamp: String,
    pub payload: serde_json::Value,
    pub signature: String,
}

pub struct MatrixMyceliumBridge {
    config: BridgeConfig,
    server_directory: HashMap<String, ServerInfo>,
    mycelium_client: reqwest::Client,
}

impl MatrixMyceliumBridge {
    pub async fn new(config: BridgeConfig) -> Result<Self, Box<dyn std::error::Error>> {
        let mycelium_client = reqwest::Client::new();
        
        Ok(Self {
            config,
            server_directory: HashMap::new(),
            mycelium_client,
        })
    }
    
    pub async fn start(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let listener = TcpListener::bind("127.0.0.1:8080").await?;
        
        // Start discovery service
        self.start_discovery_service().await?;
        
        // Start message processing
        self.start_message_processor().await?;
        
        // Handle HTTP requests
        loop {
            let (stream, _) = listener.accept().await?;
            let bridge = self.clone();
            
            tokio::spawn(async move {
                bridge.handle_request(stream).await;
            });
        }
    }
    
    async fn send_federation_event(&self, event: FederationEvent) -> Result<(), Box<dyn std::error::Error>> {
        // Translate Matrix event to Mycelium message
        let mycelium_msg = self.translate_to_mycelium(event).await?;
        
        // Send via Mycelium
        self.send_mycelium_message(mycelium_msg).await?;
        
        Ok(())
    }
    
    async fn translate_to_mycelium(&self, event: FederationEvent) -> Result<MyceliumMessage, Box<dyn std::error::Error>> {
        let msg = MyceliumMessage {
            version: "1.0".to_string(),
            source_server: self.config.server_name.clone(),
            destination_server: event.destination,
            message_type: "federation_event".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            payload: serde_json::json!({
                "event_type": event.event_type,
                "event_data": event.event_data
            }),
            signature: self.sign_message(&event).await?,
        };
        
        Ok(msg)
    }
    
    async fn send_mycelium_message(&self, msg: MyceliumMessage) -> Result<(), Box<dyn std::error::Error>> {
        let topic = format!("matrix.federation.{}", msg.destination_server);
        
        let response = self.mycelium_client
            .post(&format!("{}/api/v1/message", self.config.mycelium_api_url))
            .json(&serde_json::json!({
                "topic": topic,
                "data": serde_json::to_string(&msg)?
            }))
            .send()
            .await?;
            
        if response.status().is_success() {
            tracing::info!("Message sent successfully to {}", msg.destination_server);
        } else {
            tracing::error!("Failed to send message: {}", response.status());
        }
        
        Ok(())
    }
}
```

#### Discovery Service

**Server Announcement**:
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct ServerAnnouncement {
    pub server_name: String,
    pub mycelium_address: String,
    pub public_key: String,
    pub capabilities: Vec<String>,
    pub capacity: ServerCapacity,
    pub timestamp: String,
    pub signature: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServerCapacity {
    pub max_users: u32,
    pub current_users: u32,
    pub available: bool,
}

impl MatrixMyceliumBridge {
    async fn start_discovery_service(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        // Announce this server
        self.announce_server().await?;
        
        // Listen for other server announcements
        self.listen_for_announcements().await?;
        
        // Periodic re-announcement
        let bridge = self.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(300));
            loop {
                interval.tick().await;
                if let Err(e) = bridge.announce_server().await {
                    tracing::error!("Failed to announce server: {}", e);
                }
            }
        });
        
        Ok(())
    }
    
    async fn announce_server(&self) -> Result<(), Box<dyn std::error::Error>> {
        let announcement = ServerAnnouncement {
            server_name: self.config.server_name.clone(),
            mycelium_address: self.get_mycelium_address().await?,
            public_key: self.get_public_key(),
            capabilities: vec!["matrix_federation".to_string(), "tf_connect_auth".to_string()],
            capacity: self.get_current_capacity().await?,
            timestamp: chrono::Utc::now().to_rfc3339(),
            signature: self.sign_announcement(&announcement).await?,
        };
        
        self.mycelium_client
            .post(&format!("{}/api/v1/message", self.config.mycelium_api_url))
            .json(&serde_json::json!({
                "topic": "matrix.discovery",
                "data": serde_json::to_string(&announcement)?
            }))
            .send()
            .await?;
            
        tracing::info!("Server announced to discovery service");
        Ok(())
    }
    
    async fn listen_for_announcements(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let bridge = self.clone();
        tokio::spawn(async move {
            loop {
                match bridge.poll_discovery_messages().await {
                    Ok(announcements) => {
                        for announcement in announcements {
                            bridge.process_server_announcement(announcement).await;
                        }
                    }
                    Err(e) => {
                        tracing::error!("Failed to poll discovery messages: {}", e);
                        tokio::time::sleep(std::time::Duration::from_secs(30)).await;
                    }
                }
                
                tokio::time::sleep(std::time::Duration::from_secs(60)).await;
            }
        });
        
        Ok(())
    }
}
```

### Matrix Homeserver Integration

#### Synapse Plugin

**Plugin Structure**:
```python
# synapse_mycelium_federation/__init__.py
from synapse.module_api import ModuleApi
from synapse.federation.sender import FederationSender
from synapse.federation.federation_client import FederationClient
import aiohttp
import asyncio
import logging

logger = logging.getLogger(__name__)

class MyceliumFederationModule:
    def __init__(self, config: dict, api: ModuleApi):
        self.api = api
        self.config = config
        self.bridge_url = config.get("bridge_url", "http://localhost:8080")
        self.session = aiohttp.ClientSession()
        
        # Replace federation transport
        self._patch_federation_transport()
    
    def _patch_federation_transport(self):
        """Replace HTTP federation with Mycelium bridge calls"""
        original_send = FederationSender._send_request
        
        async def mycelium_send(self, destination: str, method: str, path: str, data=None):
            """Send federation request via Mycelium bridge"""
            try:
                bridge_data = {
                    "destination": destination,
                    "method": method,
                    "path": path,
                    "data": data
                }
                
                async with self.session.post(
                    f"{self.bridge_url}/federation/send",
                    json=bridge_data
                ) as response:
                    if response.status == 200:
                        return await response.json()
                    else:
                        logger.error(f"Bridge request failed: {response.status}")
                        raise Exception(f"Federation send failed: {response.status}")
                        
            except Exception as e:
                logger.error(f"Mycelium federation send failed: {e}")
                # Fallback to original HTTP if needed
                return await original_send(destination, method, path, data)
        
        # Monkey patch the federation sender
        FederationSender._send_request = mycelium_send
    
    @staticmethod
    def parse_config(config_dict: dict) -> dict:
        return config_dict.get("mycelium_federation", {})

def create_module(config: dict, api: ModuleApi) -> MyceliumFederationModule:
    return MyceliumFederationModule(config, api)
```

**Synapse Configuration**:
```yaml
# homeserver.yaml
modules:
  - module: synapse_mycelium_federation.MyceliumFederationModule
    config:
      bridge_url: "http://localhost:8080"
      enable_fallback: true
      discovery_interval: 300

# Disable default federation
send_federation: false
federation_domain_whitelist: []

# Custom federation settings
mycelium_federation:
  bridge_url: "http://localhost:8080"
  server_name: "matrix1.threefold.pro"
  signing_key_path: "/data/signing.key"
```

#### Dendrite Integration

**Go Module**:
```go
// dendrite-mycelium-federation/main.go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
    
    "github.com/matrix-org/dendrite/federationapi"
    "github.com/matrix-org/dendrite/setup/config"
)

type MyceliumFederationAPI struct {
    bridgeURL string
    client    *http.Client
}

type FederationRequest struct {
    Destination string      `json:"destination"`
    Method      string      `json:"method"`
    Path        string      `json:"path"`
    Data        interface{} `json:"data,omitempty"`
}

func NewMyceliumFederationAPI(bridgeURL string) *MyceliumFederationAPI {
    return &MyceliumFederationAPI{
        bridgeURL: bridgeURL,
        client: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
}

func (m *MyceliumFederationAPI) SendFederationRequest(
    ctx context.Context,
    destination string,
    method string,
    path string,
    data interface{},
) (*http.Response, error) {
    
    req := FederationRequest{
        Destination: destination,
        Method:      method,
        Path:        path,
        Data:        data,
    }
    
    reqBody, err := json.Marshal(req)
    if err != nil {
        return nil, fmt.Errorf("failed to marshal request: %w", err)
    }
    
    httpReq, err := http.NewRequestWithContext(
        ctx,
        "POST",
        fmt.Sprintf("%s/federation/send", m.bridgeURL),
        bytes.NewReader(reqBody),
    )
    if err != nil {
        return nil, fmt.Errorf("failed to create request: %w", err)
    }
    
    httpReq.Header.Set("Content-Type", "application/json")
    
    resp, err := m.client.Do(httpReq)
    if err != nil {
        return nil, fmt.Errorf("federation request failed: %w", err)
    }
    
    return resp, nil
}

// Integration with Dendrite federation API
func SetupMyceliumFederation(cfg *config.Dendrite) {
    myceliumAPI := NewMyceliumFederationAPI("http://localhost:8080")
    
    // Replace default federation client
    federationapi.SetCustomFederationClient(myceliumAPI)
}
```

### Performance Specifications

#### Latency Targets
- **Local Network**: <50ms message delivery
- **Regional**: <200ms message delivery  
- **Global**: <500ms message delivery
- **Federation Discovery**: <1s server lookup

#### Throughput Targets
- **Messages per Second**: 1000+ per homeserver
- **Concurrent Users**: 1000+ per homeserver
- **Federation Events**: 10,000+ per second network-wide
- **Discovery Updates**: 100+ servers per minute

#### Resource Requirements
- **CPU**: 2-4 cores for 1000 users
- **Memory**: 2-4GB RAM for 1000 users
- **Storage**: 1GB per 1000 users per month
- **Network**: 10Mbps for 1000 active users

### Security Specifications

#### Message Authentication
```rust
use ed25519_dalek::{Keypair, Signature, Signer, Verifier};

impl MatrixMyceliumBridge {
    async fn sign_message(&self, message: &str) -> Result<String, Box<dyn std::error::Error>> {
        let keypair = self.get_signing_keypair()?;
        let signature = keypair.sign(message.as_bytes());
        Ok(base64::encode(signature.to_bytes()))
    }
    
    async fn verify_message(&self, message: &str, signature: &str, public_key: &str) -> bool {
        match (
            base64::decode(signature),
            base64::decode(public_key)
        ) {
            (Ok(sig_bytes), Ok(key_bytes)) => {
                if let (Ok(signature), Ok(public_key)) = (
                    Signature::from_bytes(&sig_bytes),
                    ed25519_dalek::PublicKey::from_bytes(&key_bytes)
                ) {
                    public_key.verify(message.as_bytes(), &signature).is_ok()
                } else {
                    false
                }
            }
            _ => false
        }
    }
}
```

#### Transport Security
- **Mycelium Encryption**: All P2P traffic encrypted by Mycelium
- **Message Signing**: Ed25519 signatures for all federation messages
- **Server Authentication**: Public key verification for server identity
- **Replay Protection**: Timestamp validation and nonce tracking

#### Access Control
- **Federation Whitelist**: Optional server allowlist
- **Rate Limiting**: Per-server message rate limits
- **Abuse Prevention**: Automatic blocking of malicious servers
- **Audit Logging**: Complete federation event logging

### Testing Specifications

#### Unit Tests
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_message_translation() {
        let bridge = create_test_bridge().await;
        let matrix_event = create_test_matrix_event();
        
        let mycelium_msg = bridge.translate_to_mycelium(matrix_event).await.unwrap();
        
        assert_eq!(mycelium_msg.version, "1.0");
        assert_eq!(mycelium_msg.message_type, "federation_event");
        assert!(!mycelium_msg.signature.is_empty());
    }
    
    #[tokio::test]
    async fn test_server_discovery() {
        let mut bridge = create_test_bridge().await;
        
        bridge.announce_server().await.unwrap();
        
        // Verify announcement was sent
        let announcements = bridge.poll_discovery_messages().await.unwrap();
        assert!(!announcements.is_empty());
    }
    
    #[tokio::test]
    async fn test_federation_delivery() {
        let bridge = create_test_bridge().await;
        let event = create_test_federation_event();
        
        let result = bridge.send_federation_event(event).await;
        assert!(result.is_ok());
    }
}
```

#### Integration Tests
```python
# tests/integration/test_matrix_federation.py
import pytest
import asyncio
from matrix_client import MatrixClient

@pytest.mark.asyncio
async def test_cross_server_messaging():
    """Test messaging between two homeservers via Mycelium"""
    
    # Setup two test homeservers
    server1 = await setup_test_homeserver("matrix1.test")
    server2 = await setup_test_homeserver("matrix2.test")
    
    # Create users on each server
    user1 = await server1.register_user("alice", "password")
    user2 = await server2.register_user("bob", "password")
    
    # Create room and invite cross-server
    room = await user1.create_room()
    await user1.invite_user(room.id, "@bob:matrix2.test")
    await user2.join_room(room.id)
    
    # Send message and verify delivery
    message = "Hello from Matrix over Mycelium!"
    await user1.send_message(room.id, message)
    
    # Verify message received on other server
    messages = await user2.get_messages(room.id, limit=1)
    assert len(messages) == 1
    assert messages[0].content == message
    assert messages[0].sender == "@alice:matrix1.test"

@pytest.mark.asyncio
async def test_server_discovery():
    """Test automatic server discovery via Mycelium"""
    
    bridge = await setup_test_bridge()
    
    # Start discovery
    await bridge.start_discovery_service()
    
    # Wait for discovery
    await asyncio.sleep(5)
    
    # Check server directory
    servers = await bridge.get_known_servers()
    assert len(servers) > 0
    assert any(s.server_name == "matrix1.test" for s in servers)
```

#### Performance Tests
```rust
#[cfg(test)]
mod performance_tests {
    use super::*;
    use std::time::Instant;
    
    #[tokio::test]
    async fn test_message_throughput() {
        let bridge = create_test_bridge().await;
        let num_messages = 1000;
        
        let start = Instant::now();
        
        let mut tasks = Vec::new();
        for i in 0..num_messages {
            let bridge = bridge.clone();
            let event = create_test_federation_event();
            
            tasks.push(tokio::spawn(async move {
                bridge.send_federation_event(event).await
            }));
        }
        
        // Wait for all messages to complete
        for task in tasks {
            task.await.unwrap().unwrap();
        }
        
        let duration = start.elapsed();
        let throughput = num_messages as f64 / duration.as_secs_f64();
        
        println!("Throughput: {:.2} messages/second", throughput);
        assert!(throughput > 100.0); // Minimum 100 msg/sec
    }
    
    #[tokio::test]
    async fn test_discovery_latency() {
        let bridge = create_test_bridge().await;
        
        let start = Instant::now();
        bridge.announce_server().await.unwrap();
        let announce_time = start.elapsed();
        
        let start = Instant::now();
        let servers = bridge.poll_discovery_messages().await.unwrap();
        let discovery_time = start.elapsed();
        
        println!("Announce latency: {:?}", announce_time);
        println!("Discovery latency: {:?}", discovery_time);
        
        assert!(announce_time.as_millis() < 1000); // <1s to announce
        assert!(discovery_time.as_millis() < 5000); // <5s to discover
    }
}
