# Mycelium Chat

A decentralized Matrix chat system using Mycelium P2P networking for federation transport.

## Overview

Mycelium Chat combines the Matrix protocol with [Mycelium](https://github.com/threefoldtech/mycelium) P2P networking to create a truly decentralized messaging system. Instead of traditional HTTP federation, Matrix homeservers communicate via the encrypted Mycelium overlay network, enabling deployment without public IP addresses or complex networking setup.

## Key Features

- **Matrix Protocol Compatibility**: Full Matrix ecosystem support (Element, bridges, bots)
- **Mycelium P2P Federation**: Homeservers federate via encrypted P2P network
- **TF Connect Authentication**: Seamless ThreeFold identity integration
- **Decentralized Discovery**: Automatic homeserver discovery and load balancing
- **Cross-Platform Deployment**: Windows, Linux, macOS installers
- **Production Ready**: Comprehensive testing and monitoring

## Architecture

```
Element Web Client (chat.example.com)
            ↓
Matrix Homeserver (Synapse) ←→ Matrix-Mycelium Bridge ←→ Mycelium P2P Network
            ↓                                                      ↑
TF Connect Auth Provider                              Discovery Service
```

**Components:**
- **Element Web Client**: Custom branded Matrix client at chat.example.com
- **Matrix Homeserver**: Standard Synapse server with TF Connect authentication
- **Matrix-Mycelium Bridge**: Translates Matrix federation to Mycelium messages
- **Discovery Service**: Homeserver registration and load balancing
- **TF Connect Auth Provider**: ThreeFold identity integration for Matrix

## Quick Start

### Single Local Test Deployment
```bash
# Clone repository
git clone https://github.com/mik-tf/mycelium-chat
cd mycelium-chat

# Start with Docker Compose
docker-compose up -d

# Access at http://localhost:8080
```

### Production Deployment
See [Deployment Guide](./docs/ops/current/deployment.md) for detailed instructions:

**Windows:**
```powershell
# Download and run installer
.\installers\windows\install.ps1
```

**Linux/macOS:**
```bash
# Download and run installer
./installers/linux/install.sh    # or macos/install.sh
```

**Manual Setup:**
```bash
# Build components
cargo build --release
cd auth-provider && pip install -e .

# Configure and start services
# See deployment guide for details
```

### For Operators
- [Single Server Setup](./docs/ops/current/single-server.md)
- [Multi-Server Federation](./docs/ops/current/multi-server.md)
- [Monitoring & Maintenance](./docs/ops/current/monitoring.md)

### For Developers
```bash
git clone <repository-url>
cd mycelium-chat

# Start development environment
docker-compose up -d

# Run tests
cd tests/integration
./test_runner.sh
```

## Documentation

### Architecture & Design
- [System Architecture](./docs/dev/current/architecture.md)
- [Technical Specifications](./docs/dev/current/technical-specs.md)
- [TF Connect Integration](./docs/dev/current/tf-connect-integration.md)

### Operations & Deployment
- [Deployment Guide](./docs/ops/current/deployment.md)
- [Single Server Setup](./docs/ops/current/single-server.md)
- [Multi-Server Federation](./docs/ops/current/multi-server.md)
- [Monitoring & Troubleshooting](./docs/ops/current/monitoring.md)

### Development
- [Development Roadmap](./docs/dev/current/roadmap.md)
- [Testing Framework](./tests/README.md)
- [Contributing Guide](./CONTRIBUTING.md)

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) for details.

## Links

- [Mycelium Network](https://github.com/threefoldtech/mycelium)
- [MyceliumFlut](https://github.com/threefoldtech/myceliumflut)
- [ThreeFold Connect](https://github.com/threefoldtech/threefold_connect)
- [ChatScope UI Kit](https://github.com/chatscope/chat-ui-kit-react)
