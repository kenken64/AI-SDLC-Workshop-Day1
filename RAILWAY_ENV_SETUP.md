# Railway Environment Variable Setup

## Required Environment Variable

To deploy this application on Railway, you need to set the following environment variable:

### NEXT_PUBLIC_RP_ID

This is required for WebAuthn authentication to work correctly.

**Value**: Your Railway deployment domain (without https://)

Example: `ai-sdlc-workshop-day1-production.up.railway.app`

## How to Set in Railway Dashboard

1. Go to your Railway project dashboard
2. Click on your service
3. Go to the **Variables** tab
4. Click **+ New Variable**
5. Add:
   - **Key**: `NEXT_PUBLIC_RP_ID`
   - **Value**: `ai-sdlc-workshop-day1-production.up.railway.app` (or your actual Railway domain)
6. Click **Add**
7. Railway will automatically redeploy with the new environment variable

## How It Works

- Railway automatically passes environment variables as build arguments to Docker
- The Dockerfile uses `ARG NEXT_PUBLIC_RP_ID` to accept the value during build
- Next.js bundles this into the client-side JavaScript at build time
- WebAuthn uses this as the Relying Party ID for passkey authentication

## Important Notes

- ⚠️ **NEXT_PUBLIC_*** variables are baked into the build, so Railway must rebuild after changing them
- The domain should match exactly where your app is deployed
- Do not include `https://` in the value
- If you change your Railway domain, update this variable and redeploy
