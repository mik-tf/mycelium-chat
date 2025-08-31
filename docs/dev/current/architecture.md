# Mycelium Chat Architecture

## Overview

Mycelium Chat is a decentralized messaging system that combines Matrix protocol for messaging with Mycelium P2P network for transport. This architecture solves the CORS limitations of direct Mycelium HTTP API access while providing a production-ready, scalable messaging platform.

## Core Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                           │
├─────────────────────────────────────────────────────────────┤
│ chat.threefold.pro (GitHub Pages)                          │
│ ├── Element Web Client                                     │
│ ├── TF Connect Authentication                              │
│ └── Homeserver Discovery Service                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTPS (No CORS)
┌─────────────────────────────────────────────────────────────┐
│                   Backend Federation                        │
├─────────────────────────────────────────────────────────────┤
│ Multiple Matrix Homeservers                                │
│ ├── matrix1.threefold.pro (Operator A)                     │
│ ├── matrix2.threefold.pro (Operator B)                     │
│ └── matrix3.threefold.pro (Operator C)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Mycelium P2P Transport
┌─────────────────────────────────────────────────────────────┐
│                  Mycelium P2P Network                       │
├─────────────────────────────────────────────────────────────┤
│ ├── End-to-end encrypted communication                     │
│ ├── Locality-aware routing                                 │
│ ├── Automatic rerouting                                    │
│ └── Global network with public nodes                       │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

**1. Matrix Protocol for Messaging**
- Proven, battle-tested messaging protocol
- Rich ecosystem of clients (Element, FluffyChat, etc.)
- End-to-end encryption built-in
- Federation support for decentralization

**2. Mycelium for Transport**
- Replaces traditional HTTP federation between homeservers
- P2P networking eliminates need for public IP addresses
- IPv6 overlay network with automatic routing
- No central servers or dependencies

**3. Element Web Client**
- Standard Matrix client - no custom development needed
- Works on all platforms (web, mobile, desktop)
- Familiar user interface
- No CORS issues (standard HTTPS to homeserver)

**4. TF Connect Integration**
- Single sign-on using ThreeFold Connect identity
- Solves user discovery "cold start" problem
- Maps TF Connect IDs to Matrix user IDs
- Leverages existing ThreeFold ecosystem

## Federation Model

### Traditional Matrix Federation
```
Homeserver A ←→ HTTPS/HTTP ←→ Homeserver B
```

### Mycelium-Powered Federation
```
Homeserver A ←→ Matrix-Mycelium Bridge ←→ Mycelium Network ←→ Matrix-Mycelium Bridge ←→ Homeserver B
```

### Federation Flow

1. **Server Discovery**
   - Homeservers announce availability on Mycelium topic `matrix.discovery`
   - Discovery service maintains list of available homeservers
   - Load balancing distributes users across servers

2. **User Registration**
   - User visits `chat.threefold.pro`
   - Authenticates with TF Connect
   - Gets assigned to available homeserver: `@user:matrix1.threefold.pro`

3. **Cross-Server Messaging**
   - Messages sent via standard Matrix client-server API
   - Homeserver routes federation events through Mycelium
   - Receiving homeserver delivers to target user
   - End-to-end encryption maintained throughout

## Deployment Architecture

### Frontend Deployment
- **Platform**: GitHub Pages (static hosting)
- **URL**: `https://chat.threefold.pro`
- **Content**: Element Web client + TF Connect configuration
- **Benefits**: Free hosting, global CDN, HTTPS by default

### Backend Deployment Options

**1. ThreeFold Grid**
- Deploy Matrix homeserver on TF Grid VMs
- Pay with TFT tokens
- Decentralized infrastructure
- Global node availability

**2. Personal Computers**
- Windows/macOS/Linux support
- No public IP required (Mycelium handles networking)
- One-click installer packages
- Home/office deployment

**3. Traditional VPS**
- DigitalOcean, Linode, AWS, etc.
- Standard cloud deployment
- Predictable pricing
- High availability options

### Minimum Viable Deployment

**Single Homeserver Setup:**
- One Matrix homeserver (any platform)
- Mycelium daemon running alongside
- Matrix-Mycelium bridge component
- TF Connect authentication module

**Requirements:**
- 2GB RAM minimum
- 20GB storage
- Stable internet connection
- Mycelium network access

## Technical Components

### Matrix-Mycelium Bridge

**Purpose**: Translates Matrix federation protocol to Mycelium messages

**Implementation**: Rust service that:
- Receives Matrix federation events from homeserver
- Encodes events as Mycelium messages
- Routes messages via Mycelium topics
- Handles server discovery and routing

**API Integration**:
```rust
// Matrix federation event → Mycelium message
POST /api/v1/message
Topic: "matrix.federation.{target_server}"
Payload: Matrix federation event JSON

// Mycelium message → Matrix federation event  
GET /api/v1/messages?topic=matrix.federation.{local_server}
Response: Array of Matrix federation events
```

### Homeserver Discovery Service

**Purpose**: Maintains registry of available Matrix homeservers

**Implementation**:
- Lightweight service running on each homeserver
- Publishes availability to `matrix.discovery` topic
- Provides load balancing for user registration
- Handles server health monitoring

**Discovery Protocol**:
```json
{
  "server_name": "matrix1.threefold.pro",
  "mycelium_address": "400:8f3b:7c2a:1d4e:9a6f:2b8c:5e1a:3f7d",
  "capacity": {
    "max_users": 1000,
    "current_users": 47,
    "available": true
  },
  "features": ["tf_connect_auth", "e2ee", "federation"],
  "timestamp": "2025-08-30T21:27:00Z"
}
```

### TF Connect Authentication Module

**Purpose**: Integrates ThreeFold Connect SSO with Matrix homeserver

**Implementation**:
- Custom authentication provider for Synapse/Dendrite
- Handles TF Connect OAuth flow
- Maps TF Connect IDs to Matrix user IDs
- Provides user discovery capabilities

**User ID Mapping**:
```
TF Connect ID: "alice.3bot"
Matrix User ID: "@alice:matrix1.threefold.pro"
Display Name: "Alice (alice.3bot)"
```

## Security Model

### End-to-End Encryption
- Matrix's Olm/Megolm encryption protocols
- Device verification and key management
- Forward secrecy and post-compromise security
- No additional encryption needed (Matrix + Mycelium both provide encryption)

### Network Security
- Mycelium provides transport-level encryption
- IPv6 overlay network with cryptographic routing
- No plaintext communication over internet
- Automatic rerouting around compromised nodes

### Authentication Security
- TF Connect provides identity verification
- Matrix handles session management
- No password storage on homeservers
- Decentralized identity (no central auth server)

## Scalability Model

### Horizontal Scaling
- More users → more operators deploy homeservers
- Automatic load distribution via discovery service
- No central bottlenecks or single points of failure
- Geographic distribution improves latency

### Network Growth Pattern
```
Week 1:    1 homeserver  (bootstrap)
Month 1:   5 homeservers (early adopters)
Month 6:   50 homeservers (community growth)
Year 1:    500+ homeservers (global network)
```

### Resource Requirements by Scale
- **Small** (1-100 users): 2GB RAM, 20GB storage
- **Medium** (100-1000 users): 4GB RAM, 100GB storage  
- **Large** (1000+ users): 8GB+ RAM, 500GB+ storage

## Advantages Over Alternatives

### vs. Direct Mycelium API
- ✅ No CORS issues (standard HTTPS)
- ✅ Production-ready clients (Element)
- ✅ Mobile app support
- ✅ Familiar user experience

### vs. Traditional Matrix
- ✅ No public IP requirements
- ✅ P2P federation (no HTTP dependencies)
- ✅ Decentralized infrastructure
- ✅ Automatic network discovery

### vs. Custom Chat Solutions
- ✅ Proven protocol and security
- ✅ Existing client ecosystem
- ✅ Federation and interoperability
- ✅ Reduced development complexity

## Future Enhancements

### Phase 1: MVP
- Single homeserver deployment
- Basic Element web client
- TF Connect authentication
- Mycelium federation bridge

### Phase 2: Multi-Server
- Multiple homeserver support
- Automatic discovery service
- Load balancing and failover
- Cross-platform installers

### Phase 3: Advanced Features
- Mobile push notifications
- File sharing and media
- Voice/video calling
- Advanced moderation tools

### Phase 4: Ecosystem
- Third-party client support
- Plugin architecture
- Advanced federation features
- Community governance tools
