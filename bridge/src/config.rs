use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeConfig {
    pub server_name: String,
    pub bind_address: String,
    pub matrix_homeserver_url: String,
    pub mycelium_api_url: String,
    pub signing_key_path: String,
    pub max_users: u32,
}

impl BridgeConfig {
    pub fn from_file(path: &str) -> Result<Self> {
        let content = fs::read_to_string(path)?;
        let config: BridgeConfig = toml::from_str(&content)?;
        Ok(config)
    }
    
    pub fn default() -> Self {
        Self {
            server_name: "matrix.localhost".to_string(),
            bind_address: "127.0.0.1:8080".to_string(),
            matrix_homeserver_url: "http://localhost:8008".to_string(),
            mycelium_api_url: "http://localhost:8989".to_string(),
            signing_key_path: "./data/signing.key".to_string(),
            max_users: 1000,
        }
    }
}

impl Default for BridgeConfig {
    fn default() -> Self {
        Self::default()
    }
}
