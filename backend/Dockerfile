FROM node:20-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Cloud Run uses PORT env var
EXPOSE 8080

# Run as non-root for security
USER node

CMD ["node", "server.js"]
