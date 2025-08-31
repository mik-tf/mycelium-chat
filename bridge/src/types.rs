use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FederationEvent {
    pub destination: String,
    pub event_type: String,
    pub event_data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MyceliumMessage {
    pub version: String,
    pub source_server: String,
    pub destination_server: String,
    pub message_type: String,
    pub timestamp: String,
    pub payload: serde_json::Value,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerAnnouncement {
    pub server_name: String,
    pub mycelium_address: String,
    pub public_key: String,
    pub capabilities: Vec<String>,
    pub capacity: ServerCapacity,
    pub timestamp: String,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerCapacity {
    pub max_users: u32,
    pub current_users: u32,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    pub server_name: String,
    pub mycelium_address: String,
    pub public_key: String,
    pub capabilities: Vec<String>,
    pub capacity: ServerCapacity,
    pub last_seen: DateTime<Utc>,
    pub status: ServerStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ServerStatus {
    Online,
    Offline,
    Unknown,
}
