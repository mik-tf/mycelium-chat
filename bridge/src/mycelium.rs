use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::{error, info};

#[derive(Debug, Clone)]
pub struct MyceliumClient {
    client: Client,
    api_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MyceliumMessage {
    pub topic: String,
    pub data: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MyceliumInfo {
    pub address: String,
    pub public_key: String,
    pub peers: Vec<String>,
}

impl MyceliumClient {
    pub fn new(api_url: String) -> Self {
        Self {
            client: Client::new(),
            api_url,
        }
    }
    
    pub async fn send_message(&self, topic: &str, data: &str) -> Result<()> {
        let message = MyceliumMessage {
            topic: topic.to_string(),
            data: data.to_string(),
        };
        
        let response = self.client
            .post(&format!("{}/api/v1/message", self.api_url))
            .json(&message)
            .send()
            .await?;
            
        if response.status().is_success() {
            info!("Message sent to topic: {}", topic);
            Ok(())
        } else {
            error!("Failed to send message: {}", response.status());
            Err(anyhow::anyhow!("Failed to send message: {}", response.status()))
        }
    }
    
    pub async fn get_messages(&self, topic: &str) -> Result<Vec<String>> {
        let response = self.client
            .get(&format!("{}/api/v1/messages", self.api_url))
            .query(&[("topic", topic)])
            .send()
            .await?;
            
        if response.status().is_success() {
            let messages: Vec<Value> = response.json().await?;
            let data: Vec<String> = messages
                .into_iter()
                .filter_map(|msg| msg.get("data").and_then(|d| d.as_str().map(|s| s.to_string())))
                .collect();
            Ok(data)
        } else {
            error!("Failed to get messages: {}", response.status());
            Err(anyhow::anyhow!("Failed to get messages: {}", response.status()))
        }
    }
    
    pub async fn get_info(&self) -> Result<MyceliumInfo> {
        let response = self.client
            .get(&format!("{}/api/v1/info", self.api_url))
            .send()
            .await?;
            
        if response.status().is_success() {
            let info: MyceliumInfo = response.json().await?;
            Ok(info)
        } else {
            error!("Failed to get Mycelium info: {}", response.status());
            Err(anyhow::anyhow!("Failed to get Mycelium info: {}", response.status()))
        }
    }
    
    pub async fn health_check(&self) -> bool {
        match self.get_info().await {
            Ok(_) => true,
            Err(_) => false,
        }
    }
}
