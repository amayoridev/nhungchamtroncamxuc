# Multi-stage Dockerfile optimized for Northflank
# Stage 1: Build client and server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install all dependencies for building (including devDependencies)
RUN npm ci || npm install

# Copy application source code
COPY . .

# Build Vite frontend assets and bundle Express backend
RUN npm run build

# Stage 2: Production container runtime
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy package descriptors
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy compiled bundles from builder stage
COPY --from=builder /app/dist ./dist

# Copy runtime server data (seed templates, podcasts, fallback data)
COPY --from=builder /app/server ./server

# Copy public assets if present
COPY --from=builder /app/public ./public

# Expose default HTTP application port
EXPOSE 3000

# Northflank & Docker container health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

# Start production server
CMD ["node", "dist/server.cjs"]
