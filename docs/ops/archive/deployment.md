# GitHub Pages Deployment Guide

This guide covers deploying the Mycelium Chat web application to GitHub Pages.

## Prerequisites

- GitHub repository with the Mycelium Chat code
- GitHub account with Pages enabled
- Domain name (optional, for custom domains)

## Step 1: GitHub Secrets Configuration

**IMPORTANT**: Never commit `.env` files to your repository. Instead, use GitHub Secrets for secure configuration.

1. **Go to your GitHub repository** → Settings → Secrets and variables → Actions

2. **Add this Repository Secret**:

- `VITE_APP_DOMAIN`: Your domain (e.g., `chat.yourdomain.com`)

The workflow automatically configures:
- App name as "Mycelium Chat"
- TF Connect App ID using your domain
- TF Connect public key (hardcoded for simplicity)
- Other standard configuration values

3. **Example**:
   ```
   VITE_APP_DOMAIN=chat.your-domain.com
   ```

## Step 2: GitHub Pages Setup

1. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: "GitHub Actions"
   - Workflow automatically uses your GitHub Secrets

2. **Deployment process**:
   - GitHub Actions creates `.env` file from your Secrets
   - Builds the application with your domain configuration
   - Deploys to GitHub Pages automatically

## Step 3: Custom Domain Configuration

1. **DNS Configuration**:
   ```
   Type: CNAME
   Name: chat
   Value: <username>.github.io
   ```

2. **GitHub Pages Custom Domain**:
   - Go to Settings → Pages
   - Custom domain: `your-domain.com`
   - Enable "Enforce HTTPS"

3. **Verify HTTPS**:
   - Wait for SSL certificate provisioning
   - Test: `https://your-domain.com`

## Step 5: ThreeFold Connect Configuration

1. **TF Connect appid** automatically matches your domain via GitHub Secrets

2. **Test authentication flow**:
   - Visit your deployed domain
   - Click "Login with ThreeFold Connect"
   - Verify redirect to `your-domain.com/src/callback.html`

## Step 6: Verification

1. **Build locally**:
   ```bash
   cd web
   npm run build
   npm run preview
   ```

2. **Test production build**:
   - Verify all assets load correctly
   - Test ThreeFold Connect authentication
   - Check callback handling

## Troubleshooting

### Build Fails
- Check Node.js version (18+ required)
- Verify all dependencies installed: `npm ci`
- Check TypeScript errors: `npm run type-check`

### Custom Domain Not Working
- Verify DNS propagation: `dig your-domain.com`
- Check GitHub Pages settings
- Wait up to 24 hours for DNS propagation

### HTTPS Certificate Issues
- Ensure "Enforce HTTPS" is enabled
- Wait for certificate provisioning (can take hours)
- Try disabling/re-enabling custom domain

### TF Connect Authentication Fails
- Verify appid matches your domain exactly
- Check callback URL is accessible
- Review [tf-connect-troubleshooting.md](../tf-connect-troubleshooting.md)

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_APP_DOMAIN` | Your deployment domain | `your-domain.com` |
| `VITE_TF_CONNECT_APPID` | TF Connect application ID | `your-domain.com` |
| `VITE_CALLBACK_URL` | OAuth callback path | `/src/callback.html` |
| `VITE_MYCELIUM_API_URL` | Mycelium API endpoint | `http://localhost:8989` |

## Security Considerations

1. **HTTPS Only**: Never deploy without HTTPS
2. **Environment Variables**: Don't commit `.env` files
3. **API Keys**: Use GitHub Secrets for sensitive data
4. **Domain Verification**: Ensure you control the domain

## Maintenance

1. **Updates**: Push to main branch triggers auto-deployment
2. **Monitoring**: Check GitHub Actions for build status
3. **Logs**: Review deployment logs for issues
4. **Backups**: GitHub maintains deployment history
