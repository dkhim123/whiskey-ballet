# Vercel Deployment Guide

## Overview
This repository is configured for automatic deployment to Vercel with CI/CD validation through GitHub Actions.

## How It Works

### 1. GitHub Actions CI
- Runs on every push to `main`, `develop`, and PR branches
- Tests build on Node.js 18.x and 20.x
- Ensures the application builds successfully before deployment

### 2. Vercel Integration
Vercel deploys automatically when:
- A commit is pushed to the `main` branch
- GitHub Actions CI passes successfully
- No build errors are present

## Why Vercel Might Not Deploy

If Vercel isn't deploying your commits, check these common issues:

### 1. **Failed CI Checks**
- Vercel waits for required status checks to pass
- Check the "Actions" tab in GitHub for build failures
- Fix any build errors shown in the logs

### 2. **Branch Protection Rules**
- Go to Settings → Branches → Branch protection rules
- Ensure required checks don't block all deployments
- Vercel needs at least one successful check to deploy

### 3. **Webhook Configuration**
- Go to Settings → Webhooks
- Find the Vercel webhook
- Check recent deliveries for failed requests
- If failing, reconnect the Vercel integration

### 4. **Vercel Project Settings**
- Open your project in Vercel Dashboard
- Go to Settings → Git
- Ensure "Production Branch" is set to `main`
- Check that "Automatically Deploy" is enabled

## Deployment Configuration

### Build Settings (vercel.json)
```json
{
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

### Build Command
```bash
npm run build
# Runs: next build --webpack
```

## Troubleshooting

### Build Fails Locally
```bash
# Install dependencies
npm install

# Try building
npm run build

# If it fails, check the error messages
```

###Build Passes Locally But Fails in CI
- Check Node.js version (must be 18.x or 20.x)
- Ensure all dependencies are in `package.json`
- Check for environment-specific code

### Vercel Shows Old Deployment
- Check commit SHA in Vercel dashboard
- Manually trigger redeploy if needed
- Clear Vercel build cache

## Manual Deployment

If automatic deployment isn't working:

1. **Trigger from Vercel Dashboard**
   - Go to your project in Vercel
   - Click "Deployments"
   - Click "Redeploy" on the latest commit

2. **Use Vercel CLI**
   ```bash
   npm install -g vercel
   vercel --prod
   ```

## Getting Help

If deployments still aren't working:

1. Check Vercel deployment logs
2. Review GitHub Actions workflow runs
3. Verify webhook deliveries in GitHub settings
4. Contact Vercel support with deployment URL

## Related Files

- `.github/workflows/ci.yml` - CI configuration
- `vercel.json` - Vercel build configuration
- `next.config.mjs` - Next.js configuration
- `package.json` - Build scripts and dependencies
