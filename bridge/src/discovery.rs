use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn};

use crate::types::{ServerAnnouncement, ServerInfo};

#[derive(Debug, Clone)]
pub struct DiscoveryService {
    servers: HashMap<String, ServerInfo>,
}

impl DiscoveryService {
    pub fn new() -> Self {
        Self {
            servers: HashMap::new(),
        }
    }
    
    pub fn add_server(&mut self, announcement: ServerAnnouncement) {
        let server_info = ServerInfo {
            server_name: announcement.server_name.clone(),
            mycelium_address: announcement.mycelium_address,
            public_key: announcement.public_key,
            capabilities: announcement.capabilities,
            capacity: announcement.capacity,
            last_seen: chrono::Utc::now(),
            status: crate::types::ServerStatus::Online,
        };
        
        self.servers.insert(announcement.server_name.clone(), server_info);
        info!("Added server to discovery: {}", announcement.server_name);
    }
    
    pub fn get_available_servers(&self) -> Vec<&ServerInfo> {
        self.servers
            .values()
            .filter(|server| server.capacity.available)
            .collect()
    }
    
    pub fn get_server(&self, server_name: &str) -> Option<&ServerInfo> {
        self.servers.get(server_name)
    }
    
    pub fn select_server_for_user(&self) -> Option<&ServerInfo> {
        // Simple load balancing - select server with lowest user count
        self.get_available_servers()
            .into_iter()
            .min_by_key(|server| server.capacity.current_users)
    }
    
    pub fn cleanup_stale_servers(&mut self, max_age_minutes: i64) {
        let cutoff = chrono::Utc::now() - chrono::Duration::minutes(max_age_minutes);
        
        let stale_servers: Vec<String> = self.servers
            .iter()
            .filter(|(_, server)| server.last_seen < cutoff)
            .map(|(name, _)| name.clone())
            .collect();
            
        for server_name in stale_servers {
            self.servers.remove(&server_name);
            warn!("Removed stale server: {}", server_name);
        }
    }
}
