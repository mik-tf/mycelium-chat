use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryConfig {
    pub server: ServerConfig,
    pub cleanup: CleanupConfig,
    pub persistence: PersistenceConfig,
    pub security: SecurityConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub bind_address: String,
    pub port: u16,
    pub cors_origins: Vec<String>,
    pub max_servers: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupConfig {
    pub interval_seconds: u64,
    pub stale_threshold_minutes: i64,
    pub max_offline_duration_hours: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistenceConfig {
    pub enabled: bool,
    pub file_path: Option<PathBuf>,
    pub save_interval_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    pub require_signature: bool,
    pub trusted_keys: Vec<String>,
    pub rate_limit_per_minute: u32,
}

impl Default for DiscoveryConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                bind_address: "0.0.0.0".to_string(),
                port: 3000,
                cors_origins: vec!["*".to_string()],
                max_servers: 1000,
            },
            cleanup: CleanupConfig {
                interval_seconds: 300, // 5 minutes
                stale_threshold_minutes: 10,
                max_offline_duration_hours: 24,
            },
            persistence: PersistenceConfig {
                enabled: true,
                file_path: Some(PathBuf::from("servers.json")),
                save_interval_seconds: 60,
            },
            security: SecurityConfig {
                require_signature: false, // Disabled for development
                trusted_keys: vec![],
                rate_limit_per_minute: 60,
            },
        }
    }
}

impl DiscoveryConfig {
    pub fn load_from_file(path: &str) -> anyhow::Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let config: DiscoveryConfig = toml::from_str(&content)?;
        Ok(config)
    }

    pub fn save_to_file(&self, path: &str) -> anyhow::Result<()> {
        let content = toml::to_string_pretty(self)?;
        std::fs::write(path, content)?;
        Ok(())
    }
}
