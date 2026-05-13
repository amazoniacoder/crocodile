# Docker Deployment Configuration

## Production Docker Compose

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.prod
    container_name: crocodile-app
    restart: unless-stopped
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - PORT=5000
      - HOST=0.0.0.0
      - DATABASE_URL=postgres://crocodile:${POSTGRES_PASSWORD}@postgres:5432/crocodile_db
      - REDIS_URL=redis://redis:6379
      - NER_SERVICE_URL=http://ner-service:8001
      - ADMIN_TOKEN=${ADMIN_TOKEN}
      - VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}
      - VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY}
      - VAPID_SUBJECT=${VAPID_SUBJECT}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./public/uploads:/app/public/uploads
      - ./logs:/app/logs
    networks:
      - crocodile-network
    deploy:
      resources:
        limits:
          memory: 1200M
        reservations:
          memory: 800M

  ner-service:
    build:
      context: ./ner-service
      dockerfile: Dockerfile
    container_name: crocodile-ner
    restart: unless-stopped
    ports:
      - "8001:8001"
    environment:
      - PYTHONPATH=/app
    networks:
      - crocodile-network
    deploy:
      resources:
        limits:
          memory: 600M
        reservations:
          memory: 400M

  postgres:
    image: postgres:17-alpine
    container_name: crocodile-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=crocodile_db
      - POSTGRES_USER=crocodile
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    networks:
      - crocodile-network
    command: >
      postgres
      -c shared_buffers=512MB
      -c effective_cache_size=1536MB
      -c work_mem=16MB
      -c maintenance_work_mem=128MB
      -c max_connections=50
      -c log_statement=all
      -c log_min_duration_statement=1000
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U crocodile -d crocodile_db"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 1024M
        reservations:
          memory: 700M

  redis:
    image: redis:7-alpine
    container_name: crocodile-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - crocodile-network
    command: >
      redis-server
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
      --save ""
      --appendonly no
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 600M
        reservations:
          memory: 100M

  nginx:
    image: nginx:alpine
    container_name: crocodile-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./public/uploads:/var/www/uploads:ro
    depends_on:
      - app
    networks:
      - crocodile-network
    deploy:
      resources:
        limits:
          memory: 128M
        reservations:
          memory: 64M

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  crocodile-network:
    driver: bridge
```

## Production Dockerfile

```dockerfile
# Multi-stage build for optimization
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --only=production --no-audit
RUN cd client && npm ci --only=production --no-audit

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/client/dist ./client/dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Create necessary directories
RUN mkdir -p public/uploads logs && chown -R nodejs:nodejs public logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

## NER Service Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY main.py .

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser
RUN chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8001/health')"

# Start application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
```

## Environment Configuration

```bash
# .env.docker
NODE_ENV=production
POSTGRES_PASSWORD=your_strong_password_here
ADMIN_TOKEN=your_admin_token_here
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

## Nginx Configuration for Docker

```nginx
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:5000;
    }

    server {
        listen 80;
        server_name _;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name _;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;

        client_max_body_size 50M;
        
        gzip on;
        gzip_types text/plain text/css application/json application/javascript;

        # Uploads
        location /uploads {
            alias /var/www/uploads;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # WebSocket
        location /ws {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API
        location /api {
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # SPA
        location / {
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

## Deployment Commands

```bash
# Build and start
docker-compose --env-file .env.docker up -d --build

# View logs
docker-compose logs -f app
docker-compose logs -f ner-service

# Scale services
docker-compose up -d --scale app=2

# Update application
docker-compose build app
docker-compose up -d --no-deps app

# Backup database
docker-compose exec postgres pg_dump -U crocodile crocodile_db > backup.sql

# Monitor resources
docker stats

# Health check
docker-compose ps
```

## Resource Monitoring

```bash
# Container resource usage
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

# Detailed container info
docker inspect crocodile-app | jq '.[0].State'

# Logs with timestamps
docker-compose logs -f --timestamps app
```