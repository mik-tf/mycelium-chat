use anyhow::Result;
use clap::Parser;
use matrix_mycelium_bridge::{BridgeConfig, MatrixMyceliumBridge};
use tracing::{info, Level};
use tracing_subscriber;

#[derive(Parser)]
#[command(name = "matrix-mycelium-bridge")]
#[command(about = "Bridge between Matrix homeserver and Mycelium P2P network")]
struct Cli {
    #[arg(short, long, default_value = "config.toml")]
    config: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    let cli = Cli::parse();
    
    info!("Starting Matrix-Mycelium Bridge");
    
    // Load configuration
    let config = BridgeConfig::from_file(&cli.config)?;
    
    // Create and start bridge
    let mut bridge = MatrixMyceliumBridge::new(config).await?;
    
    info!("Bridge initialized, starting services...");
    
    // Start the bridge (this will run indefinitely)
    bridge.start().await?;
    
    Ok(())
}
