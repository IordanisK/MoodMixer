# Deployment Guide

This guide explains how to set up GitHub Actions to deploy MoodMixer to Google Cloud Platform.

## Prerequisites

1. **Google Cloud Project**: `moodmixer-6bb54` (already configured)
2. **Firebase Project**: Same project ID
3. **GitHub Secrets**: Need to be configured (see below)

## Required GitHub Secrets

### For Backend Deployment (Cloud Run)

1. **GCP_SA_KEY**: Service Account JSON key with Cloud Run permissions

   - Go to [GCP Console > IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=moodmixer-6bb54)
   - Click "Create Service Account" (or select existing)
   - Name it (e.g., `github-actions-backend`)
   - Grant these roles:
     - `Cloud Run Admin` (deploy and manage services)
     - `Service Account User` (use service accounts)
     - `Artifact Registry Writer` (push Docker images to Artifact Registry)
     - `Artifact Registry Repository Administrator` (create repositories if needed)
   - Click "Done"
   - Click on the service account → "Keys" tab → "Add Key" → "Create new key" → Select "JSON"
   - Download the JSON file
   - In GitHub: Settings → Secrets and variables → Actions → New repository secret
   - Name: `GCP_SA_KEY`
   - Value: Paste the **entire JSON file content** (starts with `{"type":"service_account",...}`)
   - Click "Add secret"

2. **FIREBASE_SERVICE_ACCOUNT**: Firebase service account JSON (same as frontend)
   - Go to [Firebase Console > Project Settings > Service Accounts](https://console.firebase.google.com/project/moodmixer-6bb54/settings/serviceaccounts/adminsdk)
   - Click "Generate new private key"
   - Add the **entire JSON content** as `FIREBASE_SERVICE_ACCOUNT` secret
   - This is used by the backend to access Firestore

### For Frontend Deployment (Firebase Hosting)

1. **FIREBASE_SERVICE_ACCOUNT**: Firebase service account JSON

   - Go to [Firebase Console > Project Settings > Service Accounts](https://console.firebase.google.com/project/moodmixer-6bb54/settings/serviceaccounts/adminsdk)
   - Click "Generate new private key"
   - Add the **entire JSON content** as `FIREBASE_SERVICE_ACCOUNT` secret

2. **EXPO_PUBLIC_API_URL**: Backend API URL (optional, for environment-specific config)
   - After backend is deployed, get the Cloud Run URL
   - Add it as `EXPO_PUBLIC_API_URL` secret (e.g., `https://moodmixer-backend-xxxxx-uc.a.run.app`)

## Backend Deployment (Cloud Run)

The backend is deployed to **Google Cloud Run** which supports:

- WebSocket connections (Socket.io)
- Auto-scaling
- Pay-per-use pricing

### Configuration

- **Service Name**: `moodmixer-backend`
- **Region**: `us-central1`
- **Memory**: 512Mi
- **CPU**: 1
- **Min Instances**: 0 (scales to zero)
- **Max Instances**: 10

### Environment Variables

The backend needs these environment variables set in Cloud Run:

- `PORT`: 8080 (automatically set by Cloud Run)
- `FIREBASE_SERVICE_ACCOUNT`: Set automatically by GitHub Actions from secret
- Add your other `.env` variables via Cloud Run console or gcloud CLI

To set additional environment variables (e.g., Spotify credentials):

```bash
gcloud run services update moodmixer-backend \
  --region=us-central1 \
  --update-env-vars="SPOTIFY_CLIENT_ID=xxx,SPOTIFY_CLIENT_SECRET=xxx,SPOTIFY_REDIRECT_URI=xxx,SPOTIFY_FRONTEND_URL=xxx"
```

**Note**: The `FIREBASE_SERVICE_ACCOUNT` is automatically set by the deployment workflow. The backend will use it to authenticate with Firestore.

## Frontend Deployment (Firebase Hosting)

The frontend web build is deployed to **Firebase Hosting**.

### Build Process

1. Installs dependencies
2. Builds web export using `expo export:web`
3. Deploys `frontend/web-build` to Firebase Hosting

### Configuration

- **Public Directory**: `frontend/web-build`
- **SPA Routing**: All routes rewrite to `/index.html`

## Manual Deployment

### Backend

```bash
# Configure Docker for Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build and push image
cd backend
IMAGE_URI="us-central1-docker.pkg.dev/moodmixer-6bb54/moodmixer-repo/moodmixer-backend"
docker build -t $IMAGE_URI:latest .
docker push $IMAGE_URI:latest

# Deploy to Cloud Run
gcloud run deploy moodmixer-backend \
  --image $IMAGE_URI:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Frontend

```bash
# Build
cd frontend
npm ci
npx expo export:web --output-dir web-build

# Deploy
firebase deploy --only hosting --project moodmixer-6bb54
```

## Updating Frontend API URL

After backend is deployed, update the frontend to use the Cloud Run URL:

1. Get the Cloud Run service URL:

   ```bash
   gcloud run services describe moodmixer-backend --region=us-central1 --format='value(status.url)'
   ```

2. Update `frontend/src/api/client.ts` to use the production URL, or set it via environment variable.

## Troubleshooting

### Backend Issues

- **Port binding**: Cloud Run sets `PORT` env var automatically
- **Firebase auth**: Ensure service account has proper permissions
- **CORS**: Update CORS settings if frontend domain changes

### Frontend Issues

- **Build fails**: Check Node.js version (18+)
- **Routing**: Ensure `firebase.json` has proper rewrites
- **API calls**: Verify `EXPO_PUBLIC_API_URL` is set correctly

## CI/CD Flow

1. **Push to main branch** triggers deployment workflows
2. **Backend**: Builds Docker image → Pushes to Artifact Registry → Deploys to Cloud Run
3. **Frontend**: Builds web export → Deploys to Firebase Hosting
4. Both deployments run in parallel

## Monitoring

- **Cloud Run**: [GCP Console > Cloud Run](https://console.cloud.google.com/run)
- **Firebase Hosting**: [Firebase Console > Hosting](https://console.firebase.google.com/project/moodmixer-6bb54/hosting)
