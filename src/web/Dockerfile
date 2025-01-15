# Stage 1: Base stage with common dependencies
FROM node:18-alpine AS base

# Security: Add non-root user
RUN addgroup -S cosmos && \
    adduser -S -G cosmos cosmos && \
    mkdir -p /app && \
    chown -R cosmos:cosmos /app

# Set working directory
WORKDIR /app

# Install dependencies
COPY --chown=cosmos:cosmos package*.json ./
RUN npm ci --audit=true && \
    npm cache clean --force

# Copy source files
COPY --chown=cosmos:cosmos . .

# Run security audit
RUN npm audit && \
    npm run security

# Stage 2: Development stage
FROM base AS development

# Expose development server and debug ports
EXPOSE 3000 9229

# Set development environment
ENV NODE_ENV=development \
    VITE_DEBUG_PORT=9229

# Configure volume mount points for development
VOLUME ["/app", "/app/node_modules"]

# Health check for development server
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Switch to non-root user
USER cosmos

# Start development server
CMD ["npm", "run", "dev"]

# Stage 3: Build stage
FROM base AS build

# Set production environment for build
ENV NODE_ENV=production

# Run type checking and linting
RUN npm run type-check && \
    npm run lint

# Build the application
RUN npm run build && \
    npm run analyze

# Stage 4: Production stage
FROM nginx:1.23-alpine AS production

# Add non-root user for nginx
RUN adduser -D -S -H -u 1000 -g 'web' web && \
    chown -R web:web /var/cache/nginx && \
    chown -R web:web /var/log/nginx && \
    chown -R web:web /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R web:web /var/run/nginx.pid

# Copy nginx configuration
COPY --chown=web:web nginx.conf /etc/nginx/nginx.conf
COPY --chown=web:web nginx.default.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build --chown=web:web /app/dist /usr/share/nginx/html

# Security headers and gzip configuration
RUN echo 'add_header X-Frame-Options "SAMEORIGIN";' > /etc/nginx/conf.d/security-headers.conf && \
    echo 'add_header X-Content-Type-Options "nosniff";' >> /etc/nginx/conf.d/security-headers.conf && \
    echo 'add_header X-XSS-Protection "1; mode=block";' >> /etc/nginx/conf.d/security-headers.conf && \
    echo 'add_header Content-Security-Policy "default-src '\''self'\''; script-src '\''self'\'' '\''unsafe-inline'\'' '\''unsafe-eval'\''; style-src '\''self'\'' '\''unsafe-inline'\''; img-src '\''self'\'' data: https:; font-src '\''self'\'' data:;";' >> /etc/nginx/conf.d/security-headers.conf

# Configure gzip compression
RUN echo 'gzip on;' > /etc/nginx/conf.d/gzip.conf && \
    echo 'gzip_vary on;' >> /etc/nginx/conf.d/gzip.conf && \
    echo 'gzip_min_length 10240;' >> /etc/nginx/conf.d/gzip.conf && \
    echo 'gzip_proxied expired no-cache no-store private auth;' >> /etc/nginx/conf.d/gzip.conf && \
    echo 'gzip_types text/plain text/css text/xml text/javascript application/javascript application/x-javascript application/xml application/json;' >> /etc/nginx/conf.d/gzip.conf

# Set resource limits
RUN echo 'worker_rlimit_nofile 8192;' >> /etc/nginx/nginx.conf

# Configure custom error pages
COPY --chown=web:web error_pages/ /usr/share/nginx/html/error_pages/

# Expose HTTP port
EXPOSE 80

# Health check for production server
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Switch to non-root user
USER web

# Start nginx server
CMD ["nginx", "-g", "daemon off;"]