# Примеры кода для Эпизода 10: "Deployment и DevOps"

> Все примеры взяты из реального кода проекта

---

## 🐳 Dockerfile — multi-stage build

```dockerfile
# Dockerfile

# Стадия 1: builder — компилируем TypeScript
FROM node:20-alpine AS builder

# Нативные модули (pg требует python3, make, g++)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Сначала копируем package.json — кэш слоёв Docker
COPY package*.json ./
COPY client/package*.json ./client/

RUN npm install
RUN cd client && npm install

# Копируем исходники
COPY . .

# Сборка TypeScript → JS + Vite → статика
RUN npm run build

# Стадия 2: production — минимальный образ (~150MB)
FROM node:20-alpine

WORKDIR /app

# Только production зависимости
COPY package*.json ./
RUN npm install --production

# Копируем артефакты из builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/public ./public

EXPOSE 5000
CMD ["node", "dist/index.js"]
```

---

## 🐍 ner-service/Dockerfile

```dockerfile
# ner-service/Dockerfile
FROM python:3.11-slim
WORKDIR /app

# --no-cache-dir — не кэшируем pip пакеты в образе
RUN pip install --no-cache-dir fastapi uvicorn natasha

COPY main.py .

# Один воркер в базовом compose
# В cluster compose переопределяем через args
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

---

## 🐳 docker-compose.yml — базовый

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://postgres:12345@db:5432/porto1
      - REDIS_URL=redis://redis:6379
      - NER_SERVICE_URL=http://ner-service:8001
    env_file: .env
    depends_on:
      - db
      - redis
      - ner-service
    restart: unless-stopped
    volumes:
      - ./public/uploads:/app/public/uploads

  ner-service:
    build: ./ner-service
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=porto1
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=12345
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

---

## 🐳 docker-compose.cluster.yml — два node

```yaml
# docker-compose.cluster.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx-cluster.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on: [app-node-1, app-node-2]
    restart: unless-stopped
    networks: [cluster-network]

  app-node-1:
    build: .
    environment:
      - NODE_ENV=production
      - PORT=5000
      - DATABASE_URL=postgres://news_user:news_password@postgres:5432/news_aggregator
      - REDIS_URL=redis://redis:6379
      - ADMIN_TOKEN=${ADMIN_TOKEN}
      - NODE_ID=node-1
    depends_on: [postgres, redis]
    restart: unless-stopped
    networks: [cluster-network]
    volumes:
      - ./logs:/app/logs

  app-node-2:
    build: .
    environment:
      - NODE_ENV=production
      - PORT=5000
      - DATABASE_URL=postgres://news_user:news_password@postgres:5432/news_aggregator
      - REDIS_URL=redis://redis:6379
      - ADMIN_TOKEN=${ADMIN_TOKEN}
      - NODE_ID=node-2
    depends_on: [postgres, redis]
    restart: unless-stopped
    networks: [cluster-network]
    volumes:
      - ./logs:/app/logs

  postgres:
    image: postgres:17-alpine
    environment:
      - POSTGRES_DB=news_aggregator
      - POSTGRES_USER=news_user
      - POSTGRES_PASSWORD=news_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./drizzle:/docker-entrypoint-initdb.d  # автомиграции
    restart: unless-stopped
    networks: [cluster-network]

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks: [cluster-network]

  ner-service:
    build: ./ner-service
    restart: unless-stopped
    networks: [cluster-network]

  rsshub:
    image: diygod/rsshub
    environment:
      - NODE_ENV=production
      - CACHE_TYPE=redis
      - REDIS_URL=redis://redis:6379
    depends_on: [redis]
    restart: unless-stopped
    networks: [cluster-network]

volumes:
  postgres_data:
  redis_data:

networks:
  cluster-network:
    driver: bridge
```

---

## ⚙️ ecosystem.config.cjs — PM2

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'crocodile',
      script: '/home/deploy/app/dist/index.js',
      cwd: '/home/deploy/app',
      instances: 2,            // 2 CPU → 2 инстанса
      exec_mode: 'cluster',    // Node.js cluster module
      autorestart: true,
      max_memory_restart: '1200M',
      env_file: '/home/deploy/app/.env',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '/home/deploy/app/logs/pm2-error.log',
      out_file:   '/home/deploy/app/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'ner-service',
      script: '/home/deploy/ner-service/venv/bin/uvicorn',
      args: 'main:app --host 0.0.0.0 --port 8001 --workers 2',
      cwd: '/home/deploy/ner-service',
      interpreter: 'none',
      autorestart: true,
      max_memory_restart: '600M',
      env: { PYTHONPATH: '/home/deploy/ner-service' }
    }
  ]
};
```

---

## 🌐 Nginx конфигурация

```nginx
# /etc/nginx/sites-available/crocodile

# HTTP → HTTPS
server {
    listen 80;
    server_name ВАШ_ДОМЕН www.ВАШ_ДОМЕН;
    return 301 https://ВАШ_ДОМЕН$request_uri;
}

# www → основной домен
server {
    listen 443 ssl http2;
    server_name www.ВАШ_ДОМЕН;
    ssl_certificate /etc/letsencrypt/live/ВАШ_ДОМЕН/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ВАШ_ДОМЕН/privkey.pem;
    return 301 https://ВАШ_ДОМЕН$request_uri;
}

# Основной сервер
server {
    listen 443 ssl http2;
    server_name ВАШ_ДОМЕН;

    ssl_certificate /etc/letsencrypt/live/ВАШ_ДОМЕН/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ВАШ_ДОМЕН/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    gzip_min_length 1024;

    # Статика — напрямую из файловой системы
    location ~* \.(css|js|mjs|woff2?|ttf|png|jpg|jpeg|gif|ico|svg|webp)$ {
        root /home/deploy/app/client/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri @proxy;
    }

    # WebSocket — sticky session по IP
    location /ws {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # API
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60;
    }

    # SPA fallback
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location @proxy {
        proxy_pass http://127.0.0.1:5000;
    }
}
```

---

## 🔧 PostgreSQL оптимизация

```ini
# /etc/postgresql/17/main/postgresql.conf

shared_buffers = 512MB
  # Кэш PostgreSQL — 1/8 RAM (4GB → 512MB)

effective_cache_size = 1536MB
  # Подсказка планировщику — 3/8 RAM
  # Не выделяет память, влияет на выбор плана запроса

work_mem = 16MB
  # На каждую операцию сортировки/хэша
  # max_connections(50) × work_mem(16MB) = 800MB max

maintenance_work_mem = 128MB
  # Для VACUUM, CREATE INDEX, ALTER TABLE

max_connections = 50
  # Pool min:2, max:20 → хватит с запасом
```

---

## 💾 Бэкапы — cron

```bash
# crontab -e
# Каждый день в 02:00 — бэкап + удаление старше 14 дней
0 2 * * * pg_dump -U crocodile -d crocodile_db -h localhost \
  -F c -f /home/deploy/backups/crocodile_$(date +\%Y\%m\%d).dump \
  && find /home/deploy/backups -name "*.dump" -mtime +14 -delete

# Восстановление
pg_restore -U crocodile -d crocodile_db -h localhost \
  -F c /home/deploy/backups/crocodile_20250507.dump
```

---

*Все примеры соответствуют реальным конфигурационным файлам проекта.*
