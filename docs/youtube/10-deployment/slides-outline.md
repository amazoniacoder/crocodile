# Слайды для Эпизода 10: "Deployment и DevOps"

> **Презентация:** 24-26 слайдов для 25-30 минут эпизода

---

### Слайд 1: Заставка
```
NewsAggregator — Deployment & DevOps
Эпизод 10: "Deployment и DevOps"

🖥️ Bare-metal: PM2 cluster + Nginx + SSL
🐳 Docker: multi-stage build + Compose
🗄️ PostgreSQL 17: оптимизация под 4 GB RAM
🔄 Zero-downtime: pm2 reload / rolling update
💾 Бэкапы: pg_dump + cron + 14 дней ротация

Сервер: Ubuntu 24.04 · 2 CPU · 4 GB RAM · 60 GB NVMe
```

### Слайд 2: Два пути деплоя
```
Bare-metal (PM2 + Nginx)        Docker Compose
─────────────────────────────────────────────────
✅ Меньше overhead               ✅ Изоляция сервисов
✅ Проще дебажить                ✅ Воспроизводимость
✅ pm2 reload — zero-downtime    ✅ Легко масштабировать
✅ Прямой доступ к БД            ✅ docker-compose.cluster.yml
❌ "Работает у меня"             ❌ +100-200 MB overhead
❌ Сложнее масштабировать        ❌ WebSocket → sticky sessions

Наш выбор для 4 GB:
  Основной: bare-metal (меньше overhead)
  Альтернатива: Docker (воспроизводимость)
```

---

## Блок 1: Сравнение (слайды 3-4)

### Слайд 3: Конфигурация сервера
```
Ubuntu 24.04 · 2 CPU · 4 GB RAM · 60 GB NVMe

Распределение памяти:
  Node.js × 2 инстанса   400-500 MB
  NER × 2 воркера        500-700 MB
  PostgreSQL             600-700 MB  (shared_buffers 512MB)
  Redis                   50-100 MB  (maxmemory 512mb)
  Nginx + ОС             200-300 MB
  ─────────────────────────────────
  Итого:               1.75-2.3 GB
  Свободно:            1.7-2.25 GB  ← комфортный запас

Swap: 1 GB (страховка при пиковой нагрузке)
  vm.swappiness=5 — своп только при реальной нехватке
```

### Слайд 4: Отличия 2 GB vs 4 GB конфигурации
```
Параметр              1 CPU / 2 GB    2 CPU / 4 GB
──────────────────────────────────────────────────
Swap                  Обязателен 2GB  Рекомендован 1GB
Node.js instances     1 (fork)        2 (cluster)
NER workers           1               2
Redis maxmemory       256 MB          512 MB
PostgreSQL buffers    по умолчанию    512 MB
PM2 max_memory        800 MB          1.2 GB
NER_BATCH_SIZE        10              15
MAX_RATE_LIMITERS     500             1000
Сборка                ~5-7 мин        ~2-3 мин
```

---

## Блок 2: Bare-metal деплой (слайды 5-12)

### Слайд 5: Порядок установки
```
1. apt update && apt upgrade
   curl wget git build-essential htop

2. Пользователь deploy (не root)
   adduser deploy → usermod -aG sudo deploy

3. Node.js 20.x
   nodesource setup_20.x → apt install nodejs

4. PM2 глобально
   npm install -g pm2

5. Python 3.11 (для NER)
   apt install python3.11 python3.11-venv

6. PostgreSQL 17
   pgdg apt repository → apt install postgresql-17

7. Redis
   apt install redis-server

8. Nginx + Certbot
   apt install nginx certbot python3-certbot-nginx
```

### Слайд 6: PostgreSQL — оптимизация под 4 GB
```sql
-- Создание пользователя и БД
CREATE USER crocodile WITH PASSWORD 'СИЛЬНЫЙ_ПАРОЛЬ';
CREATE DATABASE crocodile_db OWNER crocodile;
GRANT ALL PRIVILEGES ON DATABASE crocodile_db TO crocodile;
```

```ini
# /etc/postgresql/17/main/postgresql.conf

shared_buffers = 512MB
  # Кэш PostgreSQL — 1/8 RAM
  # Часто используемые страницы в памяти

effective_cache_size = 1536MB
  # Подсказка планировщику — 3/8 RAM
  # Не выделяет память, влияет на выбор плана

work_mem = 16MB
  # На каждую операцию сортировки/хэша
  # 50 соединений × 16MB = 800MB max

maintenance_work_mem = 128MB
  # Для VACUUM, CREATE INDEX, ALTER TABLE

max_connections = 50
  # Pool min:2, max:20 → хватит с запасом
```

### Слайд 7: Redis — кэш без персистентности
```ini
# /etc/redis/redis.conf

maxmemory 512mb
  # Жёсткий лимит памяти

maxmemory-policy allkeys-lru
  # При достижении лимита — вытесняем
  # наименее недавно используемые ключи

save ""
  # Отключаем RDB снапшоты
  # Кэш не нужно сохранять на диск

appendonly no
  # Отключаем AOF журнал
  # Кэш восстановится из БД при рестарте
```

### Слайд 8: Загрузка кода — rsync
```bash
# С локальной машины (Windows → WSL/Git Bash)
rsync -avz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='client/dist' \
  --exclude='logs' \
  --exclude='client — копия' \
  D:/BlogPro/ deploy@<IP>:/home/deploy/app/

# На сервере
cd /home/deploy/app
npm install          # ~2-3 мин на 2 CPU
npm run build        # TypeScript → JS
npx drizzle-kit migrate  # применить миграции

# Проверить
ls dist/        # index.js
ls client/dist/ # index.html + assets/
psql -U crocodile -d crocodile_db -h localhost -c "\dt"
# → 18+ таблиц
```

### Слайд 9: ecosystem.config.cjs — PM2
```javascript
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
      env: { NODE_ENV: 'production', PORT: 5000 },
      error_file: '/home/deploy/app/logs/pm2-error.log',
      out_file:   '/home/deploy/app/logs/pm2-out.log',
    },
    {
      name: 'ner-service',
      script: '/home/deploy/ner-service/venv/bin/uvicorn',
      args: 'main:app --host 0.0.0.0 --port 8001 --workers 2',
      cwd: '/home/deploy/ner-service',
      interpreter: 'none',
      autorestart: true,
      max_memory_restart: '600M',
    }
  ]
};
```

### Слайд 10: PM2 cluster — как работает
```
PM2 cluster mode (Node.js cluster module):

Master process (PM2)
    │
    ├─ Worker 0 (port 5000) ← инстанс 1
    └─ Worker 1 (port 5000) ← инстанс 2

ОС балансирует входящие TCP-соединения
между воркерами (round-robin)

Проблема WebSocket:
  Клиент подключился к Worker 0
  Следующий запрос → Worker 1
  Worker 1 не знает о WS-соединении → разрыв

Решение: sticky sessions в Nginx
  ip_hash → один клиент всегда → один воркер

Альтернатива: instances: 1, exec_mode: 'fork'
  Нет балансировки, нет проблем с WS
```

### Слайд 11: Nginx — конфигурация
```nginx
# Статика — напрямую из файловой системы (быстро)
location ~* \.(css|js|mjs|woff2?|png|jpg|svg|ico)$ {
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
    proxy_read_timeout 86400;  # 24 часа
}

# API и SPA
location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Слайд 12: SSL + Firewall
```bash
# Let's Encrypt — бесплатный SSL
sudo certbot --nginx -d ВАШ_ДОМЕН -d www.ВАШ_ДОМЕН
# → автоматически настраивает Nginx
# → автообновление через systemd timer

# Проверить автообновление
sudo certbot renew --dry-run

# Firewall — только SSH и HTTP/HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Порты закрыты снаружи:
# 5000 (Node.js) — только localhost
# 8001 (NER)     — только localhost
# 5432 (PostgreSQL) — только localhost
# 6379 (Redis)   — только localhost
```

---

## Блок 3: Docker Compose (слайды 13-18)

### Слайд 13: Multi-stage Dockerfile
```dockerfile
# Стадия 1: builder — компилируем TypeScript
FROM node:20-alpine AS builder

# Нативные модули (pg требует python3, make, g++)
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm install && cd client && npm install

COPY . .
RUN npm run build
# Результат: /app/dist/ + /app/client/dist/

# Стадия 2: production — минимальный образ
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production  # только prod зависимости

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/public ./public

EXPOSE 5000
CMD ["node", "dist/index.js"]
```

### Слайд 14: Размер образов
```
Без multi-stage:
  node:20-alpine + все зависимости + исходники
  → ~800 MB

С multi-stage:
  Стадия builder:    ~800 MB (временная, не в registry)
  Стадия production: ~150 MB (финальный образ)

Что НЕ попадает в production образ:
  ❌ TypeScript исходники
  ❌ devDependencies (ts-node, vite, eslint...)
  ❌ node_modules клиента
  ❌ .git история

Экономия: ~650 MB (в 5 раз меньше)
Быстрее: pull, push, запуск контейнера
```

### Слайд 15: NER Dockerfile
```dockerfile
# ner-service/Dockerfile
FROM python:3.11-slim
WORKDIR /app

# --no-cache-dir — не кэшируем pip пакеты в образе
RUN pip install --no-cache-dir fastapi uvicorn natasha

COPY main.py .

# Один воркер в базовом compose
# Два воркера в cluster compose (через args)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

### Слайд 16: docker-compose.yml — базовый
```yaml
services:
  app:
    build: .
    ports: ["5000:5000"]
    env_file: .env
    environment:
      - DATABASE_URL=postgres://postgres:12345@db:5432/porto1
      - REDIS_URL=redis://redis:6379
      - NER_SERVICE_URL=http://ner-service:8001
    depends_on: [db, redis, ner-service]
    volumes:
      - ./public/uploads:/app/public/uploads
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=porto1
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=12345
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on: [app]

volumes:
  postgres_data:
  redis_data:
```

### Слайд 17: docker-compose.cluster.yml — два node
```yaml
services:
  app-node-1:
    build: .
    environment:
      - NODE_ID=node-1
      - DATABASE_URL=postgres://...@postgres:5432/news_aggregator
      - REDIS_URL=redis://redis:6379
    networks: [cluster-network]

  app-node-2:
    build: .
    environment:
      - NODE_ID=node-2
      - DATABASE_URL=postgres://...@postgres:5432/news_aggregator
      - REDIS_URL=redis://redis:6379
    networks: [cluster-network]

  postgres:
    image: postgres:17-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./drizzle:/docker-entrypoint-initdb.d  # автомиграции

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru

  rsshub:
    image: diygod/rsshub
    environment:
      - CACHE_TYPE=redis
      - REDIS_URL=redis://redis:6379

networks:
  cluster-network:
    driver: bridge
```

### Слайд 18: Docker команды
```bash
# Сборка и запуск
docker-compose up -d
docker-compose ps
docker-compose logs app --tail=50

# Миграции внутри контейнера
docker-compose exec app npx drizzle-kit migrate

# Проверить размер образа
docker images crocodile
# REPOSITORY   TAG       SIZE
# crocodile    latest    148MB

# Кластерный запуск
docker-compose -f docker-compose.cluster.yml up -d

# Обновление без даунтайма
docker-compose build app
docker-compose up -d --no-deps app
# → пересоздаёт только app контейнер

# Остановка
docker-compose down
docker-compose down -v  # + удалить volumes (осторожно!)
```

---

## Блок 4: Обновление и бэкапы (слайды 19-21)

### Слайд 19: Zero-downtime обновление
```
Bare-metal: pm2 reload
  Инстанс 0 → остановить → запустить новый
  Инстанс 1 → остановить → запустить новый
  Трафик всегда обрабатывается ✅

  Полный цикл обновления:
  1. rsync (загрузить код)
  2. npm install (зависимости)
  3. npm run build (сборка)
  4. npx drizzle-kit migrate (миграции)
  5. pm2 reload crocodile (zero-downtime)

Docker: rolling update
  docker-compose build app
  docker-compose up -d --no-deps app
  → пересоздаёт только app контейнер
  → db и redis не трогаем

Откат (bare-metal):
  git stash / восстановить предыдущий dist/
  pm2 reload crocodile
```

### Слайд 20: Бэкапы PostgreSQL
```bash
# Ручной дамп (custom format — сжатый)
pg_dump -U crocodile -d crocodile_db -h localhost \
  -F c -f /home/deploy/backups/crocodile_$(date +%Y%m%d_%H%M%S).dump

# Восстановление
pg_restore -U crocodile -d crocodile_db -h localhost \
  -F c /home/deploy/backups/crocodile_20250507.dump

# Автоматический cron — каждый день в 02:00
0 2 * * * pg_dump -U crocodile -d crocodile_db -h localhost \
  -F c -f /home/deploy/backups/crocodile_$(date +\%Y\%m\%d).dump \
  && find /home/deploy/backups -name "*.dump" -mtime +14 -delete

# Хранение: 14 дней × ~50-100 MB = ~700 MB-1.4 GB
# 60 GB NVMe — места достаточно

# Проверить бэкапы
ls -lh /home/deploy/backups/
```

### Слайд 21: Мониторинг на сервере
```bash
# PM2 — статус и метрики
pm2 status              # все процессы
pm2 monit               # CPU + RAM в реальном времени
pm2 logs crocodile --lines 200
pm2 flush               # очистить логи

# Ресурсы
htop                    # CPU по ядрам, RAM
free -h                 # память
df -h                   # диск (60 GB NVMe)

# Логи Nginx
sudo tail -f /var/log/nginx/crocodile_access.log
sudo tail -f /var/log/nginx/crocodile_error.log

# Логи приложения (Winston)
tail -f /home/deploy/app/logs/combined.log
tail -f /home/deploy/app/logs/error.log

# Диск — следить за ростом
du -sh /home/deploy/app/logs/
du -sh /var/lib/postgresql/
du -sh /home/deploy/backups/
```

---

## Заключение (слайды 22-24)

### Слайд 22: Итоговая структура на сервере
```
/home/deploy/
├── app/
│   ├── dist/               ← скомпилированный сервер
│   ├── client/dist/        ← скомпилированный клиент
│   ├── public/uploads/     ← загруженные файлы
│   ├── logs/               ← Winston + PM2 логи
│   ├── .env                ← переменные окружения
│   └── ecosystem.config.cjs ← PM2 конфигурация
├── ner-service/
│   ├── venv/               ← Python virtualenv
│   └── main.py             ← FastAPI NER сервис
└── backups/                ← pg_dump (14 дней)

Nginx: /etc/nginx/sites-available/crocodile
SSL:   /etc/letsencrypt/live/ВАШ_ДОМЕН/
PostgreSQL: /var/lib/postgresql/17/main/
Redis: /var/lib/redis/
```

### Слайд 23: Ключевые решения
```
✅ Пользователь deploy (не root)
   → безопасность: компрометация не даёт root

✅ shared_buffers = 512MB (1/8 RAM)
   → PostgreSQL кэширует горячие страницы

✅ Redis без персистентности (save "")
   → кэш восстановится из БД, диск не изнашивается

✅ Multi-stage Dockerfile
   → production образ 150MB вместо 800MB

✅ depends_on + retry в db.ts
   → Docker: PostgreSQL стартует раньше app,
     но retry обрабатывает задержку готовности

✅ pm2 reload (не restart)
   → zero-downtime: инстансы перезапускаются по одному

✅ Firewall: только 22, 80, 443 открыты
   → 5000, 8001, 5432, 6379 — только localhost
```

### Слайд 24: Анонс Эпизода 11
```
🎬 Эпизод 11: "Масштабирование и кластер"

🔗 DistributedScheduler — один сбор на кластер
🏥 HealthCheckManager — мониторинг нод
⚡ FailoverController — автоматический failover
⚖️ LoadBalancer — распределение нагрузки
🔄 WebSocketManager — broadcast на кластер

Подписывайтесь! 👍
```

---

## 🎨 Дизайн-система

- **Bare-metal / PM2:** `#f59e0b` (янтарный)
- **Docker:** `#2496ed` (синий Docker)
- **PostgreSQL:** `#336791` (синий PostgreSQL)
- **Redis:** `#dc382d` (красный Redis)
- **Nginx:** `#009639` (зелёный Nginx)
- **SSL / безопасность:** `#22c55e` (зелёный)
- **Zero-downtime:** `#6366f1` (индиго)

---

*Слайды основаны на реальном production-коде и DEPLOY_GUIDE_4GB.md проекта.*
