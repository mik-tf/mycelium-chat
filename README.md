# Mycelium Chat

A decentralized P2P messaging application built on the Mycelium encrypted overlay network.

## Overview

Mycelium Chat leverages the [Mycelium](https://github.com/threefoldtech/mycelium) P2P network to provide truly decentralized, end-to-end encrypted messaging without any central servers. Users authenticate via ThreeFold Connect and discover each other through a distributed user directory.

## Key Features

- **True P2P Messaging**: Direct encrypted communication via Mycelium network
- **No Central Servers**: Fully decentralized architecture
- **Cross-Platform**: Web app + native desktop/mobile applications
- **User Discovery**: ThreeFold Connect integration for identity and peer discovery
- **Professional UI**: Built with ChatScope React components
- **Multiple Deployment Options**: Static website or embedded in MyceliumFlut

## Architecture

```
Static Web App (ChatScope UI) → Mycelium HTTP API → Mycelium P2P Network
                ↓
    ThreeFold Connect (Identity & Discovery)
```

## Quick Start

### For Users
1. Download and run [MyceliumFlut](https://github.com/threefoldtech/myceliumflut)
2. Visit the Mycelium Chat web app
3. Login with ThreeFold Connect
4. Start messaging with discovered users

### For Developers
```bash
git clone <repository-url>
cd mycelium-chat
npm install
npm run dev
```

## Documentation

- [Architecture Design](./docs/architecture.md)
- [Implementation Plan](./docs/implementation-plan.md)
- [Roadmap](./docs/roadmap.md)
- [User Discovery System](./docs/user-discovery.md)
- [Development Guide](./docs/development.md)

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) for details.

## Links

- [Mycelium Network](https://github.com/threefoldtech/mycelium)
- [MyceliumFlut](https://github.com/threefoldtech/myceliumflut)
- [ThreeFold Connect](https://github.com/threefoldtech/threefold_connect)
- [ChatScope UI Kit](https://github.com/chatscope/chat-ui-kit-react)
