# Operations Documentation

This directory contains deployment and operations documentation for Mycelium Chat.

## Contents

- **[deployment.md](./deployment.md)** - Complete GitHub Pages deployment guide
- **[environment.md](./environment.md)** - Environment variable configuration
- **[custom-domains.md](./custom-domains.md)** - Custom domain setup instructions

## Quick Start

1. **Clone and Configure**:
   ```bash
   git clone <mycelium-chat-repo>
   cd mycelium-chat/web
   cp .env.example .env
   # Edit .env with your domain settings
   ```

2. **Deploy to GitHub Pages**:
   - Follow the [deployment.md](./deployment.md) guide
   - Configure your custom domain (e.g., `chat.your-domain.com`)
   - Update ThreeFold Connect appid to match your domain

3. **Test Authentication**:
   - Access your deployed site via HTTPS
   - Test ThreeFold Connect login flow
   - Verify callback handling works correctly

## Production Domains

- **Example**: `chat.your-domain.com`
- **Development**: Configure your own domain in `.env`

## Support

For deployment issues, check:
1. [deployment.md](./deployment.md) troubleshooting section
2. [tf-connect-troubleshooting.md](../tf-connect-troubleshooting.md)
3. GitHub Pages deployment logs
