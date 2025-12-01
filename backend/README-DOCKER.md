# Building and Running Backend with Docker

This guide explains how to build and run the MoodMixer backend using Docker locally.

## Prerequisites

- Docker and Docker Compose installed
- `firebase-service-account.json` file in the `backend/` directory
- `.env` file with your environment variables (optional, but recommended)

## Quick Start

### Production Build

```bash
cd backend

# Build the Docker image
docker build -t moodmixer-backend .

# Run the container
docker run -p 4000:8080 \
  -e PORT=8080 \
  -v $(pwd)/firebase-service-account.json:/app/firebase-service-account.json:ro \
  --env-file .env \
  moodmixer-backend
```

Or using Docker Compose:

```bash
cd backend
docker-compose up --build
```

### Development Build (with hot reload)

```bash
cd backend
docker-compose -f docker-compose.dev.yml up --build
```

This will:
- Install all dependencies (including dev dependencies)
- Mount your source code for hot reload
- Run with `nodemon` for automatic restarts

## Manual Build Steps

### 1. Build the Image

```bash
cd backend
docker build -t moodmixer-backend .
```

### 2. Run the Container

```bash
docker run -d \
  --name moodmixer-backend \
  -p 4000:8080 \
  -e PORT=8080 \
  -v $(pwd)/firebase-service-account.json:/app/firebase-service-account.json:ro \
  --env-file .env \
  moodmixer-backend
```

### 3. View Logs

```bash
docker logs -f moodmixer-backend
```

### 4. Stop the Container

```bash
docker stop moodmixer-backend
docker rm moodmixer-backend
```

## Environment Variables

Create a `.env` file in the `backend/` directory with your variables:

```env
PORT=8080
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:4000/auth/spotify/callback
SPOTIFY_FRONTEND_URL=http://localhost:19006
```

Or pass them directly:

```bash
docker run -p 4000:8080 \
  -e PORT=8080 \
  -e SPOTIFY_CLIENT_ID=your_client_id \
  -e SPOTIFY_CLIENT_SECRET=your_client_secret \
  moodmixer-backend
```

## Using Firebase Service Account

The container needs access to `firebase-service-account.json`. You can either:

1. **Mount the file** (recommended for local development):
   ```bash
   -v $(pwd)/firebase-service-account.json:/app/firebase-service-account.json:ro
   ```

2. **Use environment variable** (for production):
   ```bash
   -e FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
   ```

## Testing the Build

After starting the container, test the API:

```bash
# Health check
curl http://localhost:4000/

# Should return:
# {"status":"ok","message":"MoodMixer API running with Firebase + Socket.io"}
```

## Troubleshooting

### Port Already in Use

If port 4000 is already in use, change the port mapping:

```bash
docker run -p 5000:8080 moodmixer-backend
```

Then access at `http://localhost:5000`

### Container Exits Immediately

Check the logs:

```bash
docker logs moodmixer-backend
```

Common issues:
- Missing `firebase-service-account.json`
- Missing environment variables
- Port conflicts

### Permission Denied

If you get permission errors with the service account file:

```bash
chmod 644 firebase-service-account.json
```

### Rebuild After Code Changes

For production builds, rebuild the image:

```bash
docker build -t moodmixer-backend .
docker stop moodmixer-backend
docker rm moodmixer-backend
docker run -p 4000:8080 moodmixer-backend
```

For development, use `docker-compose.dev.yml` which mounts your source code.

## Docker Compose Commands

```bash
# Start services
docker-compose up

# Start in background
docker-compose up -d

# Rebuild and start
docker-compose up --build

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Restart a service
docker-compose restart backend
```

## Production vs Development

- **Production** (`Dockerfile`): Optimized build, production dependencies only
- **Development** (`Dockerfile.dev`): Includes dev dependencies, hot reload with nodemon


