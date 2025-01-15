# Build Stage
FROM node:18-bullseye-slim AS builder
LABEL maintainer="Cosmos WFM Team"
LABEL version="1.0.0"

# Create non-root user for security
RUN groupadd -r cosmos && useradd -r -g cosmos -m -s /sbin/nologin cosmos

# Set working directory with proper permissions
WORKDIR /app
RUN chown cosmos:cosmos /app

# Copy package files with correct ownership
COPY --chown=cosmos:cosmos package*.json ./

# Install dependencies with npm ci for reproducible builds
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code and config files with proper permissions
COPY --chown=cosmos:cosmos tsconfig.json ./
COPY --chown=cosmos:cosmos src/ ./src/

# Build TypeScript code with optimizations
RUN npm run build

# Production Stage
FROM nvidia/cuda:12.0-base-ubuntu22.04 AS production
LABEL maintainer="Cosmos WFM Team"
LABEL version="1.0.0"
LABEL description="Cosmos World Foundation Model Platform Backend Service"

# Install Node.js and essential packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs \
    npm \
    ca-certificates \
    curl \
    tini \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user
RUN groupadd -r cosmos && useradd -r -g cosmos -m -s /sbin/nologin cosmos

# Set working directory
WORKDIR /app

# Copy built artifacts from builder stage
COPY --from=builder --chown=cosmos:cosmos /app/dist ./dist
COPY --from=builder --chown=cosmos:cosmos /app/node_modules ./node_modules
COPY --from=builder --chown=cosmos:cosmos /app/package.json ./

# Configure GPU runtime
ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    NODE_ENV=production \
    PORT=3000

# Set resource limits and security options
RUN mkdir -p /app/logs && \
    chown -R cosmos:cosmos /app/logs && \
    chmod -R 755 /app

# Switch to non-root user
USER cosmos

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose service port
EXPOSE ${PORT}

# Use tini as init system
ENTRYPOINT ["/usr/bin/tini", "--"]

# Define the command to run the application
CMD ["node", "dist/index.js"]

# Security hardening
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN npm audit fix

# Set secure file permissions
RUN find /app -type f -exec chmod 644 {} \; && \
    find /app -type d -exec chmod 755 {} \;

# Add security labels
LABEL org.opencontainers.image.vendor="Cosmos WFM" \
      org.opencontainers.image.title="Cosmos WFM Backend" \
      org.opencontainers.image.description="Secure production image for Cosmos WFM Backend" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.url="https://github.com/cosmos/wfm" \
      org.opencontainers.image.licenses="MIT" \
      security.selinux.type="container_runtime_t" \
      io.kubernetes.container.restart-policy="Always"