# Environment Configuration

This document explains how to configure environment variables for different deployment scenarios.

## Environment Files

- **`.env.example`** - Template with all available variables
- **`.env`** - Local development configuration (gitignored)
- **GitHub Actions** - Production environment variables

## Available Variables

### Domain Configuration
```env
# Your deployment domain
VITE_APP_DOMAIN=your-domain.com

# Application name (displayed in UI)
VITE_APP_NAME=Mycelium Chat
```

### ThreeFold Connect
```env
# TF Connect application ID (must match your domain)
VITE_TF_CONNECT_APPID=your-domain.com

# TF Connect public key (use forum.threefold.io's key)
VITE_TF_CONNECT_PUBLICKEY=your-tf-connect-public-key

# OAuth callback path
VITE_CALLBACK_URL=/src/callback.html
```

### Mycelium API
```env
# Mycelium node API endpoint
VITE_MYCELIUM_API_URL=http://localhost:8989
```

### Development Settings
```env
# Enable demo authentication for testing
VITE_DEMO_MODE=false

# Enable debug logging
VITE_DEBUG_LOGGING=false

# Base URL for assets (GitHub Pages)
VITE_BASE_URL=/
```

## Setup Instructions

### 1. Local Development
```bash
cd mycelium-chat/web
cp .env.example .env
```

Edit `.env` for local development:
```env
VITE_APP_DOMAIN=localhost:5173
VITE_TF_CONNECT_APPID=localhost:5173
VITE_DEMO_MODE=true
VITE_DEBUG_LOGGING=true
```

### 2. Production Deployment
Environment variables are configured in:
- **GitHub Actions**: `.github/workflows/deploy.yml`
- **Manual deployment**: Set before build

Production example:
```env
VITE_APP_DOMAIN=your-domain.com
VITE_TF_CONNECT_APPID=your-domain.com
VITE_DEMO_MODE=false
VITE_DEBUG_LOGGING=false
```

### 3. Custom Domain Deployment
For your own domain (e.g., `mychat.your-domain.com`):
```env
VITE_APP_DOMAIN=mychat.your-domain.com
VITE_TF_CONNECT_APPID=mychat.your-domain.com
```

## Important Notes

1. **Domain Matching**: `VITE_TF_CONNECT_APPID` must exactly match your deployment domain
2. **HTTPS Required**: TF Connect only works with HTTPS domains
3. **No Localhost in Production**: Never use `localhost` in production builds
4. **Environment Security**: Never commit `.env` files to git

## Troubleshooting

### TF Connect Authentication Fails
- Verify `VITE_TF_CONNECT_APPID` matches your domain exactly
- Ensure domain is accessible via HTTPS
- Check callback URL is reachable

### Build Fails
- Verify all required environment variables are set
- Check for typos in variable names
- Ensure values don't contain special characters that need escaping

### Local Development Issues
- Use `VITE_DEMO_MODE=true` to bypass TF Connect
- Set `VITE_DEBUG_LOGGING=true` for detailed logs
- Verify Mycelium node is running on port 8989
