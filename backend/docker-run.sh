#!/bin/bash

# Helper script to build and run the backend with Docker

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🐳 MoodMixer Backend Docker Helper${NC}\n"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if firebase-service-account.json exists
if [ ! -f "firebase-service-account.json" ]; then
    echo -e "${YELLOW}⚠️  Warning: firebase-service-account.json not found${NC}"
    echo "   The container may fail to start without it."
    read -p "   Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Parse command line arguments
MODE=${1:-prod}

if [ "$MODE" = "dev" ]; then
    echo -e "${GREEN}🔧 Starting in DEVELOPMENT mode (with hot reload)...${NC}\n"
    docker-compose -f docker-compose.dev.yml up --build
elif [ "$MODE" = "prod" ]; then
    echo -e "${GREEN}🚀 Starting in PRODUCTION mode...${NC}\n"
    docker-compose up --build
elif [ "$MODE" = "build" ]; then
    echo -e "${GREEN}🔨 Building Docker image...${NC}\n"
    docker build -t moodmixer-backend .
    echo -e "\n${GREEN}✅ Build complete!${NC}"
    echo "   Run with: docker run -p 4000:8080 moodmixer-backend"
else
    echo "Usage: ./docker-run.sh [dev|prod|build]"
    echo ""
    echo "Commands:"
    echo "  dev    - Run in development mode with hot reload"
    echo "  prod   - Run in production mode (default)"
    echo "  build  - Build the Docker image only"
    exit 1
fi


