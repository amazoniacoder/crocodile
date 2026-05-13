# Диаграммы для Эпизода 10: "Deployment и DevOps"

---

## 📊 Диаграмма 1: Bare-metal архитектура

```
Интернет
    │
    ▼
Cloudflare (опционально)
    │
    ▼
Nginx (порты 80, 443)
    │
    ├─ /ws → proxy_pass 127.0.0.1:5000 (WebSocket upgrade)
    ├─ /api → proxy_pass 127.0.0.1:5000
    ├─ /*.css|js|png → /home/deploy/app/client/dist (статика)
    └─ / → proxy_pass 127.0.0.1:5000 (SPA)
                │
                ▼
        PM2 cluster (порт 5000)
            │
            ├─ Worker 0 (Node.js)
            └─ Worker 1 (Node.js)
                │
                ├─ PostgreSQL 17 (localhost:5432)
                ├─ Redis 7 (localhost:6379)
                └─ NER-сервис (localhost:8001)
                        │
                        └─ uvicorn workers 2
                           (FastAPI + Natasha)

Firewall (ufw):
  Открыто: 22 (SSH), 80 (HTTP), 443 (HTTPS)
  Закрыто: 5000, 8001, 5432, 6379
```

---

## 📊 Диаграмма 2: Docker Compose архитектура

```
Интернет
    │
    ▼
nginx (container, порты 80:80, 443:443)
    │
    ├─ /ws → app:5000 (WebSocket)
    ├─ /api → app:5000
    └─ / → app:5000
                │
                ▼
        app (container, порт 5000)
        node:20-alpine, ~150MB
            │
            ├─ db (container)
            │   postgres:15-alpine
            │   volume: postgres_data
            │
            ├─ redis (container)
            │   redis:7-alpine
            │   volume: redis_data
            │
            └─ ner-service (container)
               python:3.11-slim
               FastAPI + Natasha

Docker network: bridge (все контейнеры видят друг друга)
Volumes: postgres_data, redis_data (персистентность)
```

---

## 📊 Диаграмма 3: Docker Compose cluster архитектура

```
Интернет
    │
    ▼
nginx (container)
    │
    ├─ upstream app-node-1:5000
    └─ upstream app-node-2:5000
            │                │
            ▼                ▼
      app-node-1       app-node-2
      NODE_ID=node-1   NODE_ID=node-2
            │                │
            └────────┬────────┘
                     │
              ┌──────┴──────┐
              │             │
           postgres       redis
           17-alpine      7-alpine
              │
           volume:
        postgres_data

      ner-service (shared)
      rsshub (shared)

cluster-network: bridge
  Все сервисы видят друг друга по имени
  app-node-1 → postgres (DNS resolution)
```

---

## 📊 Диаграмма 4: Multi-stage Dockerfile

```
docker build -t crocodile:latest .

Стадия 1: builder (временная)
┌─────────────────────────────────────────┐
│ FROM node:20-alpine AS builder          │
│                                         │
│ apk add python3 make g++               │
│ npm install (все зависимости)           │
│ cd client && npm install                │
│ COPY . .                                │
│ npm run build                           │
│                                         │
│ Результат:                              │
│   /app/dist/index.js                    │
│   /app/client/dist/                     │
│                                         │
│ Размер: ~800 MB                         │
└─────────────────────────────────────────┘
              │
              │ COPY --from=builder
              ▼
Стадия 2: production (финальный образ)
┌─────────────────────────────────────────┐
│ FROM node:20-alpine                     │
│                                         │
│ npm install --production                │
│ COPY dist/ ./dist/                      │
│ COPY client/dist/ ./client/dist/        │
│ COPY public/ ./public/                  │
│                                         │
│ EXPOSE 5000                             │
│ CMD ["node", "dist/index.js"]           │
│                                         │
│ Размер: ~150 MB (в 5 раз меньше!)       │
└─────────────────────────────────────────┘

Что НЕ попало в production:
  ❌ TypeScript исходники
  ❌ devDependencies (~400 MB)
  ❌ node_modules клиента
  ❌ .git история
```

---

## 📊 Диаграмма 5: PM2 cluster — WebSocket проблема

```
PM2 cluster mode:

Master (PM2)
    │
    ├─ Worker 0 (pid: 1234) ← порт 5000
    └─ Worker 1 (pid: 1235) ← порт 5000

ОС: round-robin балансировка TCP соединений

Проблема:
  Клиент → TCP соединение → Worker 0
  WebSocket установлен на Worker 0
  
  Следующий HTTP запрос → Worker 1
  Worker 1: "Нет такого WS соединения" → разрыв ❌

Решение 1: Nginx ip_hash (sticky sessions)
  upstream app {
    ip_hash;
    server 127.0.0.1:5000;
  }
  → один IP всегда → один воркер ✅

Решение 2: instances: 1, exec_mode: 'fork'
  Нет балансировки → нет проблем с WS ✅
  Но нет горизонтального масштабирования

Решение 3: Redis pub/sub для WS broadcast
  Worker 0 получил событие → Redis publish
  Worker 1 подписан → получает → отправляет клиентам
  (реализовано в WebSocketManager.ts)
```

---

## 📊 Диаграмма 6: Zero-downtime обновление

```
Bare-metal: pm2 reload crocodile

До reload:
  Worker 0 (старый код) ← обрабатывает запросы
  Worker 1 (старый код) ← обрабатывает запросы

Шаг 1: Worker 0 → SIGINT → graceful shutdown
  Worker 0 завершает текущие запросы
  Worker 0 останавливается
  Worker 1 (старый) ← все запросы идут сюда

Шаг 2: Новый Worker 0 (новый код) запускается
  Worker 0 (новый) ← часть запросов
  Worker 1 (старый) ← часть запросов

Шаг 3: Worker 1 → SIGINT → graceful shutdown
  Worker 1 завершает текущие запросы
  Worker 1 останавливается

Шаг 4: Новый Worker 1 (новый код) запускается
  Worker 0 (новый) ← запросы
  Worker 1 (новый) ← запросы

Даунтайм: 0 ✅

Docker: docker-compose up -d --no-deps app
  Пересоздаёт только app контейнер
  db и redis не трогаем
  Короткий даунтайм (~2-5 сек) пока контейнер стартует
```

---

## 📊 Диаграмма 7: Полный цикл деплоя

```
Разработчик (Windows)
    │
    │ rsync -avz (исключая node_modules, .git, dist)
    ▼
Сервер /home/deploy/app/
    │
    ├─ npm install
    │   (обновляем зависимости если изменились)
    │
    ├─ npm run build
    │   TypeScript → /app/dist/index.js
    │   Vite → /app/client/dist/
    │
    ├─ npx drizzle-kit migrate
    │   Применяем новые миграции БД
    │   (если есть изменения схемы)
    │
    └─ pm2 reload crocodile
        Zero-downtime перезапуск
        Worker 0 → новый код
        Worker 1 → новый код

Проверка после деплоя:
    pm2 status
    curl https://ВАШ_ДОМЕН/api/health
    pm2 logs crocodile --lines 50
```

---

*Диаграммы основаны на реальном DEPLOY_GUIDE_4GB.md и конфигурационных файлах проекта.*
