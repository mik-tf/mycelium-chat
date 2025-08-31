use anyhow::Result;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use clap::Parser;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use tracing::{info, warn, error, Level};

mod config;
mod persistence;

use config::DiscoveryConfig;
use persistence::PersistenceManager;

#[derive(Parser)]
#[command(name = "mycelium-discovery-service")]
#[command(about = "Discovery service for Matrix homeservers on Mycelium network")]
struct Cli {
    #[arg(short, long, default_value = "0.0.0.0:3000")]
    bind: String,
    
    #[arg(short, long, default_value = "config.toml")]
    config: String,
    
    #[arg(long)]
    generate_config: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    pub server_name: String,
    pub mycelium_address: String,
    pub public_key: String,
    pub capabilities: Vec<String>,
    pub capacity: ServerCapacity,
    pub last_seen: chrono::DateTime<chrono::Utc>,
    pub status: String,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ServerCapacity {
    max_users: u32,
    current_users: u32,
    available: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct RegisterRequest {
    server_name: String,
    mycelium_address: String,
    public_key: String,
    capabilities: Vec<String>,
    capacity: ServerCapacity,
    metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct QueryParams {
    available_only: Option<bool>,
    capability: Option<String>,
}

pub type ServerRegistry = Arc<RwLock<HashMap<String, ServerInfo>>>;

struct AppState {
    registry: ServerRegistry,
    config: DiscoveryConfig,
    persistence: PersistenceManager,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    let cli = Cli::parse();
    
    // Generate config file if requested
    if cli.generate_config {
        let config = DiscoveryConfig::default();
        config.save_to_file(&cli.config)?;
        info!("Generated default configuration file: {}", cli.config);
        return Ok(());
    }
    
    // Load configuration
    let config = if std::path::Path::new(&cli.config).exists() {
        DiscoveryConfig::load_from_file(&cli.config)?
    } else {
        warn!("Config file not found, using defaults");
        DiscoveryConfig::default()
    };
    
    // Initialize persistence manager
    let persistence = PersistenceManager::new(
        config.persistence.file_path.clone(),
        config.persistence.save_interval_seconds,
    );
    
    // Load existing servers from persistence
    let servers = if config.persistence.enabled {
        persistence.load_servers().await?
    } else {
        HashMap::new()
    };
    
    let registry: ServerRegistry = Arc::new(RwLock::new(servers));
    
    let app_state = Arc::new(AppState {
        registry: registry.clone(),
        config: config.clone(),
        persistence,
    });

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/servers", get(list_servers))
        .route("/servers/register", post(register_server))
        .route("/servers/select", get(select_server))
        .route("/servers/:server_name", get(get_server_info))
        .route("/stats", get(get_stats))
        .layer(CorsLayer::permissive())
        .with_state(app_state.clone());

    // Start cleanup task
    let cleanup_state = app_state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(
            std::time::Duration::from_secs(cleanup_state.config.cleanup.interval_seconds)
        );
        loop {
            interval.tick().await;
            cleanup_stale_servers(cleanup_state.clone()).await;
        }
    });
    
    // Start persistence task if enabled
    if config.persistence.enabled {
        let _persistence_task = app_state.persistence.start_periodic_save(registry.clone()).await;
    }

    let bind_addr = format!("{}:{}", config.server.bind_address, config.server.port);
    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    info!("Discovery service listening on {}", bind_addr);

    axum::serve(listener, app).await?;
    Ok(())
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "mycelium-discovery-service"
    }))
}

async fn list_servers(
    State(app_state): State<Arc<AppState>>,
    Query(params): Query<QueryParams>,
) -> Json<serde_json::Value> {
    let servers = app_state.registry.read().await;
    let mut filtered_servers: Vec<&ServerInfo> = servers.values().collect();

    if params.available_only.unwrap_or(false) {
        filtered_servers.retain(|server| server.capacity.available);
    }

    if let Some(capability) = params.capability {
        filtered_servers.retain(|server| server.capabilities.contains(&capability));
    }

    Json(serde_json::json!({
        "servers": filtered_servers,
        "total": filtered_servers.len(),
        "timestamp": chrono::Utc::now()
    }))
}

async fn register_server(
    State(app_state): State<Arc<AppState>>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Validate server registration
    if req.server_name.is_empty() || req.mycelium_address.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    
    // Check server limit
    let current_count = app_state.registry.read().await.len();
    if current_count >= app_state.config.server.max_servers {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }
    
    let server_info = ServerInfo {
        server_name: req.server_name.clone(),
        mycelium_address: req.mycelium_address,
        public_key: req.public_key,
        capabilities: req.capabilities,
        capacity: req.capacity,
        last_seen: chrono::Utc::now(),
        status: "online".to_string(),
        metadata: None,
    };

    let mut servers = app_state.registry.write().await;
    let is_update = servers.contains_key(&req.server_name);
    servers.insert(req.server_name.clone(), server_info);

    if is_update {
        info!("Updated server registration: {}", req.server_name);
    } else {
        info!("Registered new server: {}", req.server_name);
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "message": if is_update { "Server updated successfully" } else { "Server registered successfully" },
        "server_name": req.server_name
    })))
}

async fn select_server(
    State(app_state): State<Arc<AppState>>,
    Query(params): Query<QueryParams>,
) -> Json<serde_json::Value> {
    let servers = app_state.registry.read().await;
    let mut available_servers: Vec<&ServerInfo> = servers
        .values()
        .filter(|server| server.capacity.available && server.status == "online")
        .collect();
    
    // Filter by capability if requested
    if let Some(capability) = &params.capability {
        available_servers.retain(|server| server.capabilities.contains(capability));
    }

    if available_servers.is_empty() {
        return Json(serde_json::json!({
            "server": null,
            "message": "No available servers matching criteria",
            "total_servers": servers.len()
        }));
    }

    // Select server with lowest user count (load balancing)
    let selected_server = available_servers
        .into_iter()
        .min_by_key(|server| server.capacity.current_users);

    Json(serde_json::json!({
        "server": selected_server,
        "message": "Server selected successfully",
        "selection_method": "lowest_load"
    }))
}

async fn get_server_info(
    State(app_state): State<Arc<AppState>>,
    axum::extract::Path(server_name): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let servers = app_state.registry.read().await;
    
    match servers.get(&server_name) {
        Some(server) => Ok(Json(serde_json::json!({
            "server": server,
            "found": true
        }))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn get_stats(
    State(app_state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let servers = app_state.registry.read().await;
    
    let total_servers = servers.len();
    let online_servers = servers.values().filter(|s| s.status == "online").count();
    let available_servers = servers.values().filter(|s| s.capacity.available).count();
    let total_capacity: u32 = servers.values().map(|s| s.capacity.max_users).sum();
    let total_users: u32 = servers.values().map(|s| s.capacity.current_users).sum();
    
    Json(serde_json::json!({
        "total_servers": total_servers,
        "online_servers": online_servers,
        "available_servers": available_servers,
        "total_capacity": total_capacity,
        "total_users": total_users,
        "utilization_percent": if total_capacity > 0 { 
            (total_users as f64 / total_capacity as f64 * 100.0).round() 
        } else { 0.0 },
        "timestamp": chrono::Utc::now()
    }))
}

async fn cleanup_stale_servers(app_state: Arc<AppState>) {
    let cutoff = chrono::Utc::now() - chrono::Duration::minutes(
        app_state.config.cleanup.stale_threshold_minutes
    );
    let mut servers = app_state.registry.write().await;
    
    let stale_servers: Vec<String> = servers
        .iter()
        .filter(|(_, server)| server.last_seen < cutoff)
        .map(|(name, _)| name.clone())
        .collect();

    for server_name in &stale_servers {
        servers.remove(server_name);
        info!("Removed stale server: {}", server_name);
    }
    
    if !stale_servers.is_empty() {
        info!("Cleanup completed: removed {} stale servers", stale_servers.len());
    }
}
