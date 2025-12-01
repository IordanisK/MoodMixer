FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Expose Expo dev server port
EXPOSE 8081

# Start Expo dev server for web
# CI=1 prevents Expo from trying to open browser
# --web flag starts web version
# --port sets the port
# --host lan allows external connections on local network
CMD ["sh", "-c", "CI=1 npx expo start --web --port 8081 --host lan"]

