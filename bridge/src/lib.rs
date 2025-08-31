use anyhow::Result;
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use ed25519_dalek::{Keypair, Signature, Signer, Verifier};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use tracing::{error, info, warn};
use uuid::Uuid;

pub mod config;
pub mod discovery;
pub mod mycelium;
pub mod types;

pub use config::BridgeConfig;
pub use types::*;

#[derive(Clone)]
pub struct MatrixMyceliumBridge {
    config: BridgeConfig,
    server_directory: Arc<RwLock<HashMap<String, ServerInfo>>>,
    mycelium_client: reqwest::Client,
    signing_keypair: Keypair,
}

impl MatrixMyceliumBridge {
    pub async fn new(config: BridgeConfig) -> Result<Self> {
        let mycelium_client = reqwest::Client::new();
        
        // Load or generate signing keypair
        let signing_keypair = Self::load_or_generate_keypair(&config.signing_key_path)?;
        
        Ok(Self {
            config,
            server_directory: Arc::new(RwLock::new(HashMap::new())),
            mycelium_client,
            signing_keypair,
        })
    }
    
    pub async fn start(&mut self) -> Result<()> {
        // Start discovery service
        self.start_discovery_service().await?;
        
        // Start message processing
        self.start_message_processor().await?;
        
        // Start HTTP API server
        self.start_http_server().await?;
        
        Ok(())
    }
    
    async fn start_http_server(&self) -> Result<()> {
        let app = Router::new()
            .route("/health", get(health_check))
            .route("/federation/send", post(send_federation_event))
            .route("/federation/servers", get(list_servers))
            .layer(CorsLayer::permissive())
            .with_state(self.clone());
        
        let listener = tokio::net::TcpListener::bind(&self.config.bind_address).await?;
        info!("Bridge HTTP server listening on {}", self.config.bind_address);
        
        axum::serve(listener, app).await?;
        Ok(())
    }
    
    async fn start_discovery_service(&mut self) -> Result<()> {
        info!("Starting discovery service");
        
        // Announce this server
        self.announce_server().await?;
        
        // Start periodic announcements
        let bridge = self.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(300));
            loop {
                interval.tick().await;
                if let Err(e) = bridge.announce_server().await {
                    error!("Failed to announce server: {}", e);
                }
            }
        });
        
        // Start listening for announcements
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
                        error!("Failed to poll discovery messages: {}", e);
                        tokio::time::sleep(std::time::Duration::from_secs(30)).await;
                    }
                }
                
                tokio::time::sleep(std::time::Duration::from_secs(60)).await;
            }
        });
        
        Ok(())
    }
    
    async fn start_message_processor(&mut self) -> Result<()> {
        info!("Starting message processor");
        
        let bridge = self.clone();
        tokio::spawn(async move {
            loop {
                match bridge.poll_federation_messages().await {
                    Ok(messages) => {
                        for message in messages {
                            if let Err(e) = bridge.process_federation_message(message).await {
                                error!("Failed to process federation message: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        error!("Failed to poll federation messages: {}", e);
                        tokio::time::sleep(std::time::Duration::from_secs(10)).await;
                    }
                }
                
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            }
        });
        
        Ok(())
    }
    
    pub async fn send_federation_event(&self, event: FederationEvent) -> Result<()> {
        // Translate Matrix event to Mycelium message
        let mycelium_msg = self.translate_to_mycelium(event).await?;
        
        // Send via Mycelium
        self.send_mycelium_message(mycelium_msg).await?;
        
        Ok(())
    }
    
    async fn translate_to_mycelium(&self, event: FederationEvent) -> Result<MyceliumMessage> {
        let payload = serde_json::to_string(&event.event_data)?;
        let signature = self.sign_message(&payload)?;
        
        let msg = MyceliumMessage {
            version: "1.0".to_string(),
            source_server: self.config.server_name.clone(),
            destination_server: event.destination,
            message_type: "federation_event".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            payload: event.event_data,
            signature,
        };
        
        Ok(msg)
    }
    
    async fn send_mycelium_message(&self, msg: MyceliumMessage) -> Result<()> {
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
            info!("Message sent successfully to {}", msg.destination_server);
        } else {
            error!("Failed to send message: {}", response.status());
            return Err(anyhow::anyhow!("Failed to send message: {}", response.status()));
        }
        
        Ok(())
    }
    
    async fn announce_server(&self) -> Result<()> {
        let announcement = ServerAnnouncement {
            server_name: self.config.server_name.clone(),
            mycelium_address: self.get_mycelium_address().await?,
            public_key: base64::encode(self.signing_keypair.public.to_bytes()),
            capabilities: vec!["matrix_federation".to_string(), "tf_connect_auth".to_string()],
            capacity: self.get_current_capacity().await?,
            timestamp: chrono::Utc::now().to_rfc3339(),
            signature: String::new(), // Will be filled after signing
        };
        
        let announcement_json = serde_json::to_string(&announcement)?;
        let signature = self.sign_message(&announcement_json)?;
        
        let mut signed_announcement = announcement;
        signed_announcement.signature = signature;
        
        self.mycelium_client
            .post(&format!("{}/api/v1/message", self.config.mycelium_api_url))
            .json(&serde_json::json!({
                "topic": "matrix.discovery",
                "data": serde_json::to_string(&signed_announcement)?
            }))
            .send()
            .await?;
            
        info!("Server announced to discovery service");
        Ok(())
    }
    
    async fn poll_discovery_messages(&self) -> Result<Vec<ServerAnnouncement>> {
        let response = self.mycelium_client
            .get(&format!("{}/api/v1/messages", self.config.mycelium_api_url))
            .query(&[("topic", "matrix.discovery")])
            .send()
            .await?;
            
        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Failed to poll discovery messages"));
        }
        
        let messages: Vec<serde_json::Value> = response.json().await?;
        let mut announcements = Vec::new();
        
        for msg in messages {
            if let Ok(announcement) = serde_json::from_value::<ServerAnnouncement>(msg) {
                if self.verify_server_announcement(&announcement) {
                    announcements.push(announcement);
                } else {
                    warn!("Invalid server announcement signature");
                }
            }
        }
        
        Ok(announcements)
    }
    
    async fn poll_federation_messages(&self) -> Result<Vec<MyceliumMessage>> {
        let topic = format!("matrix.federation.{}", self.config.server_name);
        
        let response = self.mycelium_client
            .get(&format!("{}/api/v1/messages", self.config.mycelium_api_url))
            .query(&[("topic", &topic)])
            .send()
            .await?;
            
        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Failed to poll federation messages"));
        }
        
        let messages: Vec<serde_json::Value> = response.json().await?;
        let mut federation_messages = Vec::new();
        
        for msg in messages {
            if let Ok(federation_msg) = serde_json::from_value::<MyceliumMessage>(msg) {
                if self.verify_federation_message(&federation_msg) {
                    federation_messages.push(federation_msg);
                } else {
                    warn!("Invalid federation message signature");
                }
            }
        }
        
        Ok(federation_messages)
    }
    
    async fn process_server_announcement(&self, announcement: ServerAnnouncement) {
        let server_info = ServerInfo {
            server_name: announcement.server_name.clone(),
            mycelium_address: announcement.mycelium_address,
            public_key: announcement.public_key,
            capabilities: announcement.capabilities,
            capacity: announcement.capacity,
            last_seen: chrono::Utc::now(),
            status: ServerStatus::Online,
        };
        
        let mut directory = self.server_directory.write().await;
        directory.insert(announcement.server_name, server_info);
        
        info!("Updated server directory with {}", announcement.server_name);
    }
    
    async fn process_federation_message(&self, message: MyceliumMessage) -> Result<()> {
        info!("Processing federation message from {}", message.source_server);
        
        // Forward to Matrix homeserver
        let response = self.mycelium_client
            .post(&format!("{}/federation/receive", self.config.matrix_homeserver_url))
            .json(&message.payload)
            .send()
            .await?;
            
        if response.status().is_success() {
            info!("Federation message forwarded to Matrix homeserver");
        } else {
            error!("Failed to forward message to Matrix: {}", response.status());
        }
        
        Ok(())
    }
    
    async fn get_mycelium_address(&self) -> Result<String> {
        let response = self.mycelium_client
            .get(&format!("{}/api/v1/info", self.config.mycelium_api_url))
            .send()
            .await?;
            
        let info: serde_json::Value = response.json().await?;
        let address = info["address"].as_str()
            .ok_or_else(|| anyhow::anyhow!("Failed to get Mycelium address"))?;
            
        Ok(address.to_string())
    }
    
    async fn get_current_capacity(&self) -> Result<ServerCapacity> {
        // Query Matrix homeserver for current user count
        let response = self.mycelium_client
            .get(&format!("{}/admin/users", self.config.matrix_homeserver_url))
            .send()
            .await;
            
        let current_users = match response {
            Ok(resp) => {
                let users: serde_json::Value = resp.json().await.unwrap_or_default();
                users["total"].as_u64().unwrap_or(0) as u32
            }
            Err(_) => 0,
        };
        
        Ok(ServerCapacity {
            max_users: self.config.max_users,
            current_users,
            available: current_users < self.config.max_users,
        })
    }
    
    fn sign_message(&self, message: &str) -> Result<String> {
        let signature = self.signing_keypair.sign(message.as_bytes());
        Ok(base64::encode(signature.to_bytes()))
    }
    
    fn verify_federation_message(&self, message: &MyceliumMessage) -> bool {
        // Get public key for source server
        // For now, we'll implement basic verification
        // In production, this should verify against known server keys
        !message.signature.is_empty()
    }
    
    fn verify_server_announcement(&self, announcement: &ServerAnnouncement) -> bool {
        // Verify announcement signature
        // For now, basic verification
        !announcement.signature.is_empty()
    }
    
    fn load_or_generate_keypair(path: &str) -> Result<Keypair> {
        use std::fs;
        
        if let Ok(key_data) = fs::read(path) {
            if key_data.len() == 64 {
                let keypair = Keypair::from_bytes(&key_data)?;
                info!("Loaded existing signing keypair from {}", path);
                return Ok(keypair);
            }
        }
        
        // Generate new keypair
        let mut csprng = rand::rngs::OsRng;
        let keypair = Keypair::generate(&mut csprng);
        
        // Save to file
        if let Some(parent) = std::path::Path::new(path).parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, keypair.to_bytes())?;
        
        info!("Generated new signing keypair and saved to {}", path);
        Ok(keypair)
    }
}

// HTTP handlers
async fn health_check(State(bridge): State<MatrixMyceliumBridge>) -> Json<serde_json::Value> {
    let health = serde_json::json!({
        "status": "healthy",
        "server_name": bridge.config.server_name,
        "mycelium_connected": true, // TODO: actual health check
        "matrix_connected": true,   // TODO: actual health check
        "federation_active": true,
        "uptime": 0 // TODO: track actual uptime
    });
    
    Json(health)
}

async fn send_federation_event(
    State(bridge): State<MatrixMyceliumBridge>,
    Json(event): Json<FederationEvent>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match bridge.send_federation_event(event).await {
        Ok(()) => Ok(Json(serde_json::json!({
            "success": true,
            "message": "Federation event sent successfully"
        }))),
        Err(e) => {
            error!("Failed to send federation event: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn list_servers(State(bridge): State<MatrixMyceliumBridge>) -> Json<serde_json::Value> {
    let directory = bridge.server_directory.read().await;
    let servers: Vec<&ServerInfo> = directory.values().collect();
    
    Json(serde_json::json!({
        "servers": servers
    }))
}
