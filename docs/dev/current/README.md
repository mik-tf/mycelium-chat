# Mycelium Chat - Current Development Documentation

## Overview

This directory contains the complete technical documentation for the Matrix + Mycelium architecture of Mycelium Chat. This represents the final agreed-upon design that solves the CORS limitations of the original direct Mycelium HTTP API approach.

## Architecture Summary

**Core Innovation**: Combine Matrix protocol for messaging with Mycelium P2P network for transport, providing users with familiar Element clients while enabling true decentralized federation.

```
Element Web/Mobile ←→ Matrix Homeserver ←→ Mycelium P2P Network
     ↑                      ↑                    ↑
Standard Matrix API    Custom Transport    Decentralized
(No CORS issues)      (Mycelium replaces   Federation
                       HTTP federation)
```

## Key Benefits

- **Solves CORS Problem**: Web clients use standard HTTPS to homeservers
- **Production Ready**: Leverages battle-tested Matrix protocol and Element clients
- **True Decentralization**: P2P federation via Mycelium, no central servers
- **Cross-Platform**: Works on web, mobile, desktop without custom development
- **Familiar UX**: Standard Matrix/Element experience users already know

## Documentation Structure

### [architecture.md](./architecture.md)
Complete system architecture including:
- Component diagrams and data flow
- Matrix federation over Mycelium transport
- Element web client integration
- TF Connect authentication system
- Deployment models and scaling

### [roadmap.md](./roadmap.md)
Development timeline and milestones:
- **Phase 1**: Foundation (Matrix-Mycelium bridge, single homeserver)
- **Phase 2**: Multi-server federation and discovery
- **Phase 3**: Cross-platform distribution packages
- **Phase 4**: Ecosystem and community tools

### [ux-dx-ox.md](./ux-dx-ox.md)
Stakeholder experience design:
- **UX**: End user journey and interface design
- **DX**: Developer experience building and maintaining the system
- **OX**: Operator experience running homeservers

### [tf-connect-integration.md](./tf-connect-integration.md)
Critical lessons learned from TF Connect implementation:
- Complex WebSocket authentication flow
- Working code patterns and solutions
- Matrix authentication provider integration
- Security considerations and testing

### [deployment-guide.md](./deployment-guide.md)
Comprehensive deployment instructions:
- ThreeFold Grid deployment
- Personal computer installation (Windows/macOS/Linux)
- VPS/cloud deployment
- Docker containerization
- Configuration and monitoring

### [technical-specs.md](./technical-specs.md)
Detailed technical specifications:
- Matrix-Mycelium bridge implementation
- API specifications and message formats
- Performance targets and security model
- Testing strategies and code examples

## Quick Start for Developers

1. **Read Architecture**: Start with `architecture.md` for system overview
2. **Review TF Connect**: Study `tf-connect-integration.md` for authentication patterns
3. **Check Technical Specs**: Reference `technical-specs.md` for implementation details
4. **Follow Roadmap**: Use `roadmap.md` for development phases
5. **Deploy Testing**: Use `deployment-guide.md` for local development setup

## Key Design Decisions

### Matrix + Mycelium Integration
- Matrix homeservers federate via Mycelium P2P instead of HTTP
- Custom bridge translates Matrix federation events to Mycelium messages
- Preserves all Matrix protocol features and client compatibility

### Single Frontend, Multiple Backends
- `chat.threefold.pro` hosts Element web client (GitHub Pages)
- Multiple distributed homeservers provide backend capacity
- Users automatically assigned to available homeservers
- Transparent cross-server communication

### No Monetization (Simplified Model)
- Operators cover hosting costs voluntarily
- Users access chat for free
- Focus on community adoption over revenue
- Future monetization possible but not required

### TF Connect Authentication
- Preserves complex but working TF Connect integration
- Maps TF Connect IDs to Matrix user IDs
- Enables user discovery within ThreeFold ecosystem
- Fallback authentication for non-TF users

## Implementation Status

### Completed
- [x] Complete architecture design
- [x] Stakeholder experience definition (UX/DX/OX)
- [x] TF Connect integration analysis
- [x] Deployment strategy documentation
- [x] Technical specifications

### Next Steps
- [ ] Matrix-Mycelium bridge development (Rust)
- [ ] TF Connect authentication provider (Python/Go)
- [ ] Element web client configuration
- [ ] Cross-platform installer packages
- [ ] Multi-homeserver federation testing

## Reference Implementation

The existing web implementation in `../../../web/` serves as reference for:
- TF Connect authentication patterns (complex WebSocket flow)
- UI/UX design principles
- Configuration management
- Error handling and fallbacks

**Important**: The web implementation will be archived but preserved as it contains critical TF Connect integration knowledge that was difficult to develop.

## Development Environment

### Prerequisites
- Rust 1.70+ (for bridge development)
- Python 3.9+ (for Synapse integration)
- Go 1.19+ (for Dendrite integration)
- Docker & Docker Compose (for testing)
- Node.js 18+ (for Element customization)

### Repository Structure (Planned)
```
mycelium-matrix/
├── bridge/                 # Rust: Matrix ↔ Mycelium bridge
├── auth-provider/          # TF Connect authentication modules
├── discovery-service/      # Homeserver discovery and load balancing
├── element-config/         # Element web customization
├── installers/            # Cross-platform deployment packages
├── docs/                  # Documentation
└── tests/                 # Integration and performance tests
```

## Community and Support

### Communication Channels
- **Development**: Matrix room for technical discussions
- **Documentation**: GitHub issues for documentation improvements
- **Operators**: Dedicated channel for homeserver operators
- **Users**: General support and feedback

### Contribution Guidelines
- Follow Rust/Python/Go best practices
- Comprehensive testing required (80%+ coverage)
- Security review for all authentication code
- Documentation updates for all features

## Security Considerations

### Transport Security
- Mycelium provides P2P encryption
- Matrix provides end-to-end encryption
- Ed25519 signatures for federation messages
- TF Connect handles identity verification

### Operational Security
- Regular security updates required
- SSL/TLS for all web interfaces
- Firewall configuration guidelines
- Backup and recovery procedures

## Performance Targets

### Latency
- Local: <50ms message delivery
- Regional: <200ms message delivery
- Global: <500ms message delivery

### Throughput
- 1000+ messages/second per homeserver
- 1000+ concurrent users per homeserver
- 10,000+ federation events/second network-wide

### Scalability
- Horizontal scaling via additional homeservers
- Automatic load distribution
- Geographic distribution for latency optimization

## Future Enhancements

### Phase 2+ Features
- Voice/video calling over Mycelium
- Distributed file storage and sharing
- Advanced moderation and governance tools
- Third-party client ecosystem

### Integration Opportunities
- ThreeFold Grid native deployment
- TF Connect advanced features
- Mycelium protocol enhancements
- Matrix protocol extensions

---

This documentation represents the complete technical foundation for implementing Mycelium Chat as a production-ready, decentralized messaging platform that combines the best of Matrix protocol maturity with Mycelium P2P innovation.
