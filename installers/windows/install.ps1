# Mycelium Chat Windows Installer
# PowerShell script to install Matrix homeserver + Mycelium bridge on Windows

param(
    [string]$InstallPath = "$env:ProgramFiles\MyceliumChat",
    [switch]$Silent = $false,
    [switch]$DevMode = $false
)

$ErrorActionPreference = "Stop"

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This installer must be run as Administrator. Please run PowerShell as Administrator and try again."
    exit 1
}

Write-Host "=== Mycelium Chat Windows Installer ===" -ForegroundColor Cyan
Write-Host "Installing to: $InstallPath" -ForegroundColor Green

# Create installation directory
if (!(Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
}

# Download and install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow

# Install Chocolatey if not present
if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Chocolatey package manager..." -ForegroundColor Yellow
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
}

# Install required software
$packages = @("git", "nodejs", "python3", "rust", "docker-desktop")
foreach ($package in $packages) {
    Write-Host "Installing $package..." -ForegroundColor Yellow
    choco install $package -y
}

# Install PostgreSQL
Write-Host "Installing PostgreSQL..." -ForegroundColor Yellow
choco install postgresql --params '/Password:mycelium123' -y

# Download Mycelium Chat
Write-Host "Downloading Mycelium Chat..." -ForegroundColor Yellow
$repoPath = "$InstallPath\mycelium-chat"
if (Test-Path $repoPath) {
    Remove-Item $repoPath -Recurse -Force
}

git clone https://github.com/threefoldtech/mycelium-chat.git $repoPath
Set-Location $repoPath

# Build Rust components
Write-Host "Building Rust components..." -ForegroundColor Yellow
cargo build --release

# Install Python dependencies
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
pip install -r auth-provider/requirements.txt

# Install Synapse
Write-Host "Installing Matrix Synapse..." -ForegroundColor Yellow
pip install matrix-synapse[postgres]

# Create configuration files
Write-Host "Creating configuration files..." -ForegroundColor Yellow

$configDir = "$InstallPath\config"
if (!(Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

# Generate Synapse configuration
$synapseConfig = @"
server_name: "matrix.localhost"
pid_file: "$InstallPath\logs\homeserver.pid"
listeners:
  - port: 8008
    tls: false
    type: http
    x_forwarded: true
    resources:
      - names: [client, federation]
        compress: false

database:
  name: psycopg2
  args:
    user: postgres
    password: mycelium123
    database: synapse
    host: localhost
    cp_min: 5
    cp_max: 10

log_config: "$InstallPath\config\log.config"
media_store_path: "$InstallPath\media_store"
registration_shared_secret: "$(New-Guid)"
report_stats: false
macaroon_secret_key: "$(New-Guid)"
form_secret: "$(New-Guid)"
signing_key_path: "$InstallPath\config\signing.key"

modules:
  - module: synapse_tf_connect.TFConnectAuthProvider
    config:
      config_file: "$InstallPath\config\tf_connect.yaml"

suppress_key_server_warning: true
"@

$synapseConfig | Out-File -FilePath "$configDir\homeserver.yaml" -Encoding UTF8

# Generate TF Connect auth config
$tfConnectConfig = @"
tf_connect:
  api_base_url: "https://login.threefold.me"
  websocket_url: "wss://login.threefold.me/websocket"
  app_id: "mycelium-chat"
  redirect_uri: "https://chat.threefold.pro/auth/callback"
  dev_mode: $($DevMode.ToString().ToLower())
  session_timeout: 3600
  log_level: "INFO"
  server_name: "matrix.localhost"
"@

$tfConnectConfig | Out-File -FilePath "$configDir\tf_connect.yaml" -Encoding UTF8

# Generate bridge configuration
$bridgeConfig = @"
[server]
name = "matrix.localhost"
matrix_url = "http://localhost:8008"
mycelium_url = "http://localhost:8989"
signing_key_path = "$($InstallPath.Replace('\', '\\'))\\config\\bridge_signing.key"
max_users = 1000

[federation]
topic = "matrix.federation"
discovery_url = "https://discovery.threefold.pro"

[logging]
level = "info"
"@

$bridgeConfig | Out-File -FilePath "$configDir\bridge.toml" -Encoding UTF8

# Create Windows services
Write-Host "Creating Windows services..." -ForegroundColor Yellow

# Create service wrapper scripts
$synapseService = @"
@echo off
cd /d "$InstallPath"
python -m synapse.app.homeserver --config-path config\homeserver.yaml
"@

$synapseService | Out-File -FilePath "$InstallPath\start-synapse.bat" -Encoding ASCII

$bridgeService = @"
@echo off
cd /d "$InstallPath"
target\release\matrix-mycelium-bridge.exe --config config\bridge.toml
"@

$bridgeService | Out-File -FilePath "$InstallPath\start-bridge.bat" -Encoding ASCII

# Install as Windows services using NSSM
Write-Host "Installing Windows services..." -ForegroundColor Yellow
choco install nssm -y

# Install Synapse service
nssm install MyceliumChatSynapse "$InstallPath\start-synapse.bat"
nssm set MyceliumChatSynapse Description "Matrix Synapse homeserver for Mycelium Chat"
nssm set MyceliumChatSynapse Start SERVICE_AUTO_START

# Install Bridge service
nssm install MyceliumChatBridge "$InstallPath\start-bridge.bat"
nssm set MyceliumChatBridge Description "Matrix-Mycelium bridge for decentralized federation"
nssm set MyceliumChatBridge Start SERVICE_AUTO_START
nssm set MyceliumChatBridge DependOnService MyceliumChatSynapse

# Create database
Write-Host "Setting up database..." -ForegroundColor Yellow
$env:PGPASSWORD = "mycelium123"
createdb -U postgres synapse

# Generate signing keys
Write-Host "Generating signing keys..." -ForegroundColor Yellow
python -m synapse.app.homeserver --generate-keys --config-path "$configDir\homeserver.yaml"

# Create desktop shortcut
Write-Host "Creating desktop shortcut..." -ForegroundColor Yellow
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:PUBLIC\Desktop\Mycelium Chat.lnk")
$Shortcut.TargetPath = "https://chat.threefold.pro"
$Shortcut.IconLocation = "$InstallPath\icon.ico"
$Shortcut.Description = "Mycelium Chat - Decentralized Messaging"
$Shortcut.Save()

# Create start menu entry
$StartMenuPath = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Mycelium Chat"
if (!(Test-Path $StartMenuPath)) {
    New-Item -ItemType Directory -Path $StartMenuPath -Force | Out-Null
}

$StartMenuShortcut = $WshShell.CreateShortcut("$StartMenuPath\Mycelium Chat.lnk")
$StartMenuShortcut.TargetPath = "https://chat.threefold.pro"
$StartMenuShortcut.IconLocation = "$InstallPath\icon.ico"
$StartMenuShortcut.Description = "Mycelium Chat - Decentralized Messaging"
$StartMenuShortcut.Save()

# Create uninstaller
$uninstaller = @"
# Mycelium Chat Uninstaller
Write-Host "Uninstalling Mycelium Chat..." -ForegroundColor Yellow

# Stop and remove services
nssm stop MyceliumChatBridge
nssm stop MyceliumChatSynapse
nssm remove MyceliumChatBridge confirm
nssm remove MyceliumChatSynapse confirm

# Remove installation directory
Remove-Item "$InstallPath" -Recurse -Force -ErrorAction SilentlyContinue

# Remove shortcuts
Remove-Item "$env:PUBLIC\Desktop\Mycelium Chat.lnk" -ErrorAction SilentlyContinue
Remove-Item "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Mycelium Chat" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Mycelium Chat has been uninstalled." -ForegroundColor Green
"@

$uninstaller | Out-File -FilePath "$InstallPath\uninstall.ps1" -Encoding UTF8

# Start services
Write-Host "Starting services..." -ForegroundColor Yellow
Start-Service MyceliumChatSynapse
Start-Sleep 5
Start-Service MyceliumChatBridge

# Create firewall rules
Write-Host "Configuring Windows Firewall..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "Mycelium Chat - Matrix" -Direction Inbound -Protocol TCP -LocalPort 8008 -Action Allow
New-NetFirewallRule -DisplayName "Mycelium Chat - Bridge" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow

Write-Host ""
Write-Host "=== Installation Complete ===" -ForegroundColor Green
Write-Host "Mycelium Chat has been installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Services installed:" -ForegroundColor Cyan
Write-Host "  - MyceliumChatSynapse (Matrix homeserver)" -ForegroundColor White
Write-Host "  - MyceliumChatBridge (Mycelium bridge)" -ForegroundColor White
Write-Host ""
Write-Host "Access your chat at: https://chat.threefold.pro" -ForegroundColor Cyan
Write-Host "Local homeserver: http://localhost:8008" -ForegroundColor Cyan
Write-Host ""
Write-Host "To uninstall: Run uninstall.ps1 as Administrator" -ForegroundColor Yellow
Write-Host ""

if (!$Silent) {
    Write-Host "Press any key to open Mycelium Chat..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    Start-Process "https://chat.threefold.pro"
}
