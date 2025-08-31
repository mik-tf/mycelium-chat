# Architecture Design

## Overview

Mycelium Chat uses a hybrid architecture combining a static web application with the Mycelium P2P network for truly decentralized messaging.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Mycelium Chat System                         │
├─────────────────────────────────────────────────────────────────┤
│  Web App (Static Files)                                        │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐│
│  │   ChatScope UI  │  │  TF Connect Auth │  │ User Discovery  ││
│  │   Components    │  │                  │  │    System       ││
│  └─────────────────┘  └──────────────────┘  └─────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                    HTTP API (localhost:8989)                   │
├─────────────────────────────────────────────────────────────────┤
│  MyceliumFlut / Mycelium Daemon                                │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐│
│  │  Network GUI    │  │   P2P Routing    │  │  Message Queue  ││
│  │                 │  │                  │  │                 ││
│  └─────────────────┘  └──────────────────┘  └─────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                    Mycelium P2P Network                        │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐│
│  │ End-to-End      │  │ Automatic Peer   │  │ Multi-Transport ││
│  │ Encryption      │  │ Discovery        │  │ (TCP/QUIC/BT)   ││
│  └─────────────────┘  └──────────────────┘  └─────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend Layer

**Static Web Application**
- Built with React and ChatScope UI components
- Served as static files (GitHub Pages, IPFS, local files)
- No backend dependencies - purely client-side
- Responsive design for desktop and mobile browsers

**Key Components:**
- `MessageContainer`: Main chat interface
- `ContactList`: User discovery and contact management
- `AuthProvider`: ThreeFold Connect integration
- `MyceliumAPI`: HTTP client for Mycelium daemon

### Network Layer

**MyceliumFlut Application**
- Cross-platform GUI application (Flutter)
- Embeds Mycelium daemon with visual management
- Provides HTTP API on localhost:8989
- Handles network setup, peer management, routing

**Mycelium P2P Network**
- IPv6 overlay network with automatic routing
- End-to-end encryption for all communications
- Multi-transport support (TCP, QUIC, Bluetooth, Wi-Fi)
- Global public nodes for initial peer discovery

### Identity & Discovery

**ThreeFold Connect Integration**
- Decentralized identity provider
- OAuth-style authentication flow
- User profile management
- Group membership and visibility controls

**User Discovery System**
- Distributed directory using Mycelium topics
- Configurable visibility (public, groups, friends, private)
- Real-time presence indicators
- Search and filtering capabilities

## Data Flow

### Message Sending
1. User types message in ChatScope UI
2. Frontend calls Mycelium HTTP API
3. Mycelium daemon encrypts and routes message
4. Message travels through P2P network to recipient
5. Recipient's daemon receives and queues message
6. Recipient's UI polls API and displays message

### User Discovery
1. User logs in with ThreeFold Connect
2. Profile published to Mycelium topic-based directory
3. Other users query directory for available contacts
4. Direct P2P connections established for messaging

### Authentication Flow
1. User visits static web app
2. Redirected to ThreeFold Connect OAuth
3. Returns with identity token and profile
4. Profile used to generate Mycelium identity
5. User appears in distributed directory

## Security Model

### Encryption Layers
- **Transport**: TLS for HTTP API calls
- **Network**: Mycelium's built-in P2P encryption
- **Application**: Optional additional E2E encryption for sensitive data

### Identity Verification
- ThreeFold Connect provides cryptographic identity
- Mycelium addresses derived from public keys
- No central authority required for verification

### Privacy Controls
- Users control their visibility in directory
- Messages never stored on central servers
- Metadata minimization through P2P routing

## Deployment Models

### Web Application (Primary)
```
Static Files → GitHub Pages/IPFS → User's Browser
                     ↓
MyceliumFlut App → localhost:8989 → Mycelium Network
```

### Native Integration (Future)
```
Embedded UI → MyceliumFlut → Mycelium Network
```

### Mobile Applications (Future)
```
React Native App → Mycelium Mobile Bridge → Mycelium Network
```

## Scalability Considerations

### Network Scaling
- Mycelium handles routing optimization automatically
- No central bottlenecks or single points of failure
- Scales with number of active nodes

### User Discovery Scaling
- Topic-based sharding for large user bases
- Configurable discovery scopes (global, regional, groups)
- Caching and local storage for frequent contacts

### Message Throughput
- Direct P2P connections for optimal performance
- Automatic route optimization and failover
- Support for offline message queuing

## Technology Stack

### Frontend
- **Framework**: React 18+
- **UI Components**: ChatScope Chat UI Kit
- **Authentication**: ThreeFold Connect SDK
- **Build Tool**: Vite
- **Styling**: Tailwind CSS

### Backend/Network
- **P2P Network**: Mycelium (Rust)
- **GUI Application**: MyceliumFlut (Flutter)
- **API**: HTTP REST (localhost:8989)
- **Transport**: TCP, QUIC, Bluetooth, Wi-Fi

### Development Tools
- **Version Control**: Git
- **Package Manager**: npm/yarn
- **Testing**: Jest, React Testing Library
- **Linting**: ESLint, Prettier
- **CI/CD**: GitHub Actions
