# Deploying Rail Ops USA to Render

This guide provides step-by-step instructions for deploying your Rail Ops USA application to Render.com.

## Overview

This is a full-stack application with:
- **Frontend**: React 18 + Vite + TypeScript
- **Backend**: Express.js (Node.js)
- **Database**: Firebase Firestore (already configured)
- **Deployment Type**: Single Web Service (Express serves Vite build)

## Prerequisites

1. A Render account (sign up at https://render.com)
2. Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)
3. Firebase project with valid credentials

## Deployment Steps

### Step 1: Create a New Web Service

1. Log into your Render dashboard
2. Click **"New +"** button
3. Select **"Web Service"**
4. Connect your Git repository
5. Select your repository and branch (usually `main` or `master`)

### Step 2: Configure Build & Start Settings

Use these exact settings in your Render web service configuration:

#### Basic Settings
- **Name**: `rail-ops-usa` (or your preferred name)
- **Region**: Choose closest to your users
- **Branch**: `main` (or your default branch)
- **Runtime**: `Node`

#### Build Settings

**Root Directory**: Leave blank (defaults to repository root)

**Build Command**:
```bash
npm install && npm run build
```

**Start Command**:
```bash
npm run start
```

### Step 3: Environment Variables

Add these environment variables in the Render dashboard under **Environment** section:

#### Required Firebase Variables

| Variable Name | Description | Example Value |
|--------------|-------------|---------------|
| `VITE_FIREBASE_PROJECT_ID` | Your Firebase project ID | `train-manager-abc123` |
| `VITE_FIREBASE_APP_ID` | Your Firebase app ID | `1:1234567890:web:abcdef123456` |
| `VITE_FIREBASE_API_KEY` | Your Firebase API key | `AIzaSyAbc123def456...` |

#### System Variables

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `NODE_ENV` | `production` | Sets Node environment to production |

**Important about PORT**: 
- Do NOT manually set `PORT` as an environment variable on Render
- Render automatically provides the `PORT` variable
- The Express server code already handles this: `process.env.PORT || '5000'`
- In production, Render's auto-assigned port will be used
- The app only defaults to 5000 for local development

### Step 4: Advanced Settings

#### Auto-Deploy
- **Enable**: Yes (recommended)
- This will automatically deploy when you push to your main branch

#### Health Check Path
- **Path**: `/` (default)
- The Express server serves the React app at the root path

## File Structure Reference

Your project structure for deployment:

```
rail-ops-usa/
├── client/                 # React frontend
│   ├── src/
│   ├── public/
│   ├── index.html
│   └── ...
├── server/                 # Express backend
│   ├── index.ts           # Main server file
│   ├── routes.ts
│   ├── vite.ts            # Vite integration
│   └── ...
├── shared/                 # Shared TypeScript types
│   └── schema.ts
├── package.json           # Root package.json with build scripts
├── tsconfig.json
└── vite.config.ts
```

## Build Process Explained

When Render runs `npm run build`, the following happens:

1. **Install dependencies**: `npm install` installs all packages from `package.json`
2. **Build client**: `vite build` compiles React app to `client/dist/`
3. **Build server**: `esbuild` bundles the Express server to `dist/`
4. **Production server**: Express serves static files from `client/dist/` and handles API routes

The `build` script in `package.json`:
```json
"build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist"
```

The `start` script in `package.json`:
```json
"start": "NODE_ENV=production node dist/index.js"
```

## Important Notes

### 1. Database is Already on Firebase
- ✅ **No separate database setup needed**
- ✅ All data is stored in Firebase Firestore
- ✅ User authentication handled by Firebase Auth
- ✅ Data is scoped per user (under `/players/{userId}`)

### 2. Static Assets
- Vite builds to `client/dist/`
- Express serves these files in production mode
- All assets are bundled and optimized by Vite

### 3. API Routes
- All API routes should be prefixed with `/api`
- Express handles API requests before serving static files
- Example: `/api/jobs`, `/api/locomotives`

### 4. Client-Side Routing
- The Express server includes a catch-all route for client-side routing
- This ensures refreshing on `/dashboard`, `/jobs`, etc. works correctly
- Handled in `server/index.ts` via the Vite setup

## Environment Variable Setup in Render

1. In your Render dashboard, go to your web service
2. Click **"Environment"** in the left sidebar
3. Click **"Add Environment Variable"**
4. Add each variable from the table above
5. Click **"Save Changes"**

**Getting Firebase Credentials**:
1. Go to https://console.firebase.google.com/
2. Select your project
3. Click the gear icon → **Project settings**
4. Scroll to **"Your apps"** section
5. If no web app exists, click **"Add app"** → Select web (</>)
6. Copy the config values (apiKey, projectId, appId)

## Deployment Checklist

- [ ] Code pushed to Git repository
- [ ] Render web service created
- [ ] Build command: `npm install && npm run build`
- [ ] Start command: `npm run start`
- [ ] Runtime: Node
- [ ] All Firebase environment variables added
- [ ] `NODE_ENV` set to `production`
- [ ] Auto-deploy enabled (optional but recommended)
- [ ] Firebase project configured with Firestore and Authentication
- [ ] Firebase security rules deployed (see `firestore.rules`)

## Testing Your Deployment

After deployment completes:

1. **Check Build Logs**: Verify no errors in the build process
2. **Check Runtime Logs**: Ensure server starts successfully
3. **Test Application**:
   - Visit your Render URL (e.g., `https://rail-ops-usa.onrender.com`)
   - Sign in with Google
   - Create a company
   - Test job assignment
   - Verify data persists

## Troubleshooting

### Build Fails
- Check that `package.json` has all dependencies
- Verify Node version compatibility (use Node 20)
- Review build logs for specific errors

### App Not Loading
- Check environment variables are set correctly
- Verify Firebase credentials are valid
- Check server logs for runtime errors

### Firebase Errors
- Verify API key is correct and not restricted
- Check that Firebase Authentication is enabled
- Ensure Firestore database is created
- Verify security rules are deployed

### 404 Errors on Page Refresh
- Ensure catch-all route exists in Express
- Check that `serveStatic` is configured in production mode

## Post-Deployment

### Custom Domain (Optional)
1. In Render dashboard, go to **Settings**
2. Scroll to **Custom Domain**
3. Add your domain and follow DNS instructions

### Monitoring
- Use Render's built-in metrics for monitoring
- Check logs regularly for errors
- Set up alerts for downtime (Render Pro plan)

### Scaling
- Render free tier has limitations (spins down after inactivity)
- Upgrade to paid plan for:
  - No spin-down
  - Faster build times
  - More resources
  - Custom domains with SSL

## Cost Estimate

### Free Tier
- ✅ 750 hours/month
- ✅ Spins down after 15 minutes of inactivity
- ✅ 512 MB RAM
- ✅ Shared CPU

### Starter Plan ($7/month)
- ✅ No spin-down
- ✅ Always-on instance
- ✅ 512 MB RAM
- ✅ Better performance

### Firebase Costs
- **Free tier**: Good for development and small-scale
- **Pay-as-you-go**: Based on:
  - Firestore reads/writes
  - Authentication users
  - Storage used
- Most hobby projects stay within free tier limits

## Support

- **Render Docs**: https://render.com/docs
- **Firebase Docs**: https://firebase.google.com/docs
- **Community**: https://community.render.com/

## Summary

This deployment guide ensures your Rail Ops USA application:
- ✅ Builds correctly on Render
- ✅ Uses Firebase for all data storage
- ✅ Serves the React frontend via Express
- ✅ Handles API routes and client-side routing
- ✅ Includes proper environment variable configuration
- ✅ No separate database infrastructure needed

All data is managed by Firebase Firestore, with each user's data properly scoped under their own document path (`/players/{userId}`), preventing any data overlap or security issues.
