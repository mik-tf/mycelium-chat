use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use tokio::fs;
use tracing::{error, info, warn};

use crate::ServerInfo;

#[derive(Debug, Serialize, Deserialize)]
struct PersistedData {
    servers: HashMap<String, ServerInfo>,
    version: String,
    saved_at: chrono::DateTime<chrono::Utc>,
}

pub struct PersistenceManager {
    file_path: Option<std::path::PathBuf>,
    save_interval: std::time::Duration,
}

impl PersistenceManager {
    pub fn new(file_path: Option<std::path::PathBuf>, save_interval_seconds: u64) -> Self {
        Self {
            file_path,
            save_interval: std::time::Duration::from_secs(save_interval_seconds),
        }
    }

    pub async fn load_servers(&self) -> Result<HashMap<String, ServerInfo>> {
        let Some(path) = &self.file_path else {
            return Ok(HashMap::new());
        };

        if !path.exists() {
            info!("Persistence file does not exist, starting with empty registry");
            return Ok(HashMap::new());
        }

        match self.load_from_file(path).await {
            Ok(servers) => {
                info!("Loaded {} servers from persistence file", servers.len());
                Ok(servers)
            }
            Err(e) => {
                error!("Failed to load servers from persistence file: {}", e);
                warn!("Starting with empty registry");
                Ok(HashMap::new())
            }
        }
    }

    async fn load_from_file(&self, path: &Path) -> Result<HashMap<String, ServerInfo>> {
        let content = fs::read_to_string(path).await?;
        let data: PersistedData = serde_json::from_str(&content)?;
        
        // Filter out stale servers on load
        let cutoff = chrono::Utc::now() - chrono::Duration::hours(24);
        let fresh_servers: HashMap<String, ServerInfo> = data
            .servers
            .into_iter()
            .filter(|(_, server)| server.last_seen > cutoff)
            .collect();

        if fresh_servers.len() != data.servers.len() {
            info!(
                "Filtered out {} stale servers during load",
                data.servers.len() - fresh_servers.len()
            );
        }

        Ok(fresh_servers)
    }

    pub async fn save_servers(&self, servers: &HashMap<String, ServerInfo>) -> Result<()> {
        let Some(path) = &self.file_path else {
            return Ok(());
        };

        let data = PersistedData {
            servers: servers.clone(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            saved_at: chrono::Utc::now(),
        };

        let content = serde_json::to_string_pretty(&data)?;
        
        // Write to temporary file first, then rename for atomic operation
        let temp_path = path.with_extension("tmp");
        fs::write(&temp_path, content).await?;
        fs::rename(&temp_path, path).await?;

        Ok(())
    }

    pub async fn start_periodic_save(
        &self,
        registry: crate::ServerRegistry,
    ) -> Option<tokio::task::JoinHandle<()>> {
        let Some(path) = self.file_path.clone() else {
            return None;
        };

        let interval = self.save_interval;
        
        Some(tokio::spawn(async move {
            let mut interval_timer = tokio::time::interval(interval);
            
            loop {
                interval_timer.tick().await;
                
                let servers = registry.read().await.clone();
                
                if let Err(e) = Self::save_to_path(&path, &servers).await {
                    error!("Failed to save servers to persistence file: {}", e);
                }
            }
        }))
    }

    async fn save_to_path(path: &Path, servers: &HashMap<String, ServerInfo>) -> Result<()> {
        let data = PersistedData {
            servers: servers.clone(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            saved_at: chrono::Utc::now(),
        };

        let content = serde_json::to_string_pretty(&data)?;
        
        // Write to temporary file first, then rename for atomic operation
        let temp_path = path.with_extension("tmp");
        fs::write(&temp_path, content).await?;
        fs::rename(&temp_path, path).await?;

        Ok(())
    }
}
