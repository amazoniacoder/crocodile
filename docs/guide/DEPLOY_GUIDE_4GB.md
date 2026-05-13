# Гайд деплоя Crocodile на Ubuntu 24.04

> Сервер: Ubuntu 24.04 · 2 CPU · 4 GB RAM · 60 GB NVMe  
> Метод: терминал, без GitHub, без CI/CD  
> Стек: Node.js + PostgreSQL + Redis + NER (Python) + Nginx + PM2

---

## Отличия от конфигурации 1 CPU / 2 GB

| Параметр | 1 CPU / 2 GB | 2 CPU / 4 GB |
|----------|-------------|-------------|
| Swap | Обязателен (2 GB) | Рекомендован (1 GB, страховка) |
| Node.js instances | 1 (fork) | 2 (cluster) |
| NER workers | 1 | 2 |
| Redis maxmemory | 256 MB | 512 MB |
| PostgreSQL shared_buffers | по умолчанию | 512 MB |
| PM2 max_memory_restart | 800 MB | 1.2 GB |
| Сборка | ~5–7 мин | ~2–3 мин |

---

## Содержание

1. [Подготовка сервера](#1-подготовка-сервера)
2. [Установка зависимостей](#2-установка-зависимостей)
3. [PostgreSQL](#3-postgresql)
4. [Redis](#4-redis)
5. [NER-сервис (Python)](#5-ner-сервис-python)
6. [Загрузка кода на сервер](#6-загрузка-кода-на-сервер)
7. [Сборка приложения](#7-сборка-приложения)
8. [Переменные окружения](#8-переменные-окружения)
9. [Миграции БД](#9-миграции-бд)
10. [PM2 — запуск приложения](#10-pm2--запуск-приложения)
11. [Nginx + SSL](#11-nginx--ssl)
12. [Swap (страховка)](#12-swap-страховка)
13. [Firewall](#13-firewall)
14. [Проверка работоспособности](#14-проверка-работоспособности)
15. [Обновление приложения](#15-обновление-приложения)
16. [Мониторинг и логи](#16-мониторинг-и-логи)
17. [Резервное копирование БД](#17-резервное-копирование-бд)
18. [Типичные проблемы](#18-типичные-проблемы)

---

## 1. Подготовка сервера

```bash
ssh root@<IP_СЕРВЕРА>
```

```bash
apt update && apt upgrade -y
apt install -y curl wget git unzip build-essential software-properties-common htop
```

Создать пользователя для приложения:

```bash
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
su - deploy
```

---

## 2. Установка зависимостей

### Node.js 20.x

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v20.x.x
```

### Python 3.11

```bash
sudo apt install -y python3.11 python3.11-venv python3-pip
```

### PM2

```bash
sudo npm install -g pm2
```

---

## 3. PostgreSQL

### Установка PostgreSQL 17

```bash
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo apt install -y postgresql-17
```

### Настройка пользователя и БД

```bash
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo -u postgres psql
```

```sql
CREATE USER crocodile WITH PASSWORD 'СИЛЬНЫЙ_ПАРОЛЬ';
CREATE DATABASE crocodile_db OWNER crocodile;
GRANT ALL PRIVILEGES ON DATABASE crocodile_db TO crocodile;
\q
```

### Оптимизация под 4 GB RAM

На 4 GB RAM PostgreSQL можно дать больше памяти — это ускорит сложные запросы (полнотекстовый поиск, агрегации аналитики):

```bash
sudo nano /etc/postgresql/17/main/postgresql.conf
```

Найти и изменить:

```
shared_buffers = 512MB
effective_cache_size = 1536MB
work_mem = 16MB
maintenance_work_mem = 128MB
max_connections = 50
```

```bash
sudo systemctl restart postgresql
```

Проверить подключение:

```bash
psql -U crocodile -d crocodile_db -h localhost -c "SELECT version();"
```

---

## 4. Redis

```bash
sudo apt install -y redis-server
```

```bash
sudo nano /etc/redis/redis.conf
```

Найти и изменить / добавить:

```
maxmemory 512mb
maxmemory-policy allkeys-lru
save ""
appendonly no
```

```bash
sudo systemctl enable redis-server
sudo systemctl restart redis-server
redis-cli ping   # PONG
```

---

## 5. NER-сервис (Python)

На 2 CPU можно запустить 2 воркера uvicorn — NER будет обрабатывать батчи параллельно.

```bash
mkdir -p /home/deploy/ner-service
cd /home/deploy/ner-service
python3.11 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn natasha pymorphy2
deactivate
```

После загрузки кода (шаг 6):

```bash
cp /home/deploy/app/ner-service/main.py /home/deploy/ner-service/main.py
```

---

## 6. Загрузка кода на сервер

### Вариант A — rsync (рекомендуется)

На **локальной машине** (Windows — через WSL или Git Bash):

```bash
rsync -avz --exclude='node_modules' \
  --exclude='.git' \
  --exclude='client/node_modules' \
  --exclude='dist' \
  --exclude='client/dist' \
  --exclude='server/logs' \
  --exclude='logs' \
  --exclude='client — копия' \
  --exclude='client — копия (2)' \
  D:/BlogPro/ deploy@<IP_СЕРВЕРА>:/home/deploy/app/
```

### Вариант B — архив через scp

На **локальной машине**:

```bash
tar -czf blogpro.tar.gz \
  --exclude='./node_modules' \
  --exclude='./.git' \
  --exclude='./client/node_modules' \
  --exclude='./dist' \
  --exclude='./client/dist' \
  --exclude='./logs' \
  --exclude='./server/logs' \
  --exclude='./client — копия' \
  --exclude='./client — копия (2)' \
  -C D:/BlogPro .

scp blogpro.tar.gz deploy@<IP_СЕРВЕРА>:/home/deploy/
```

На **сервере**:

```bash
mkdir -p /home/deploy/app
cd /home/deploy
tar -xzf blogpro.tar.gz -C app/
rm blogpro.tar.gz
```

---

## 7. Сборка приложения

На 2 CPU сборка занимает 2–3 минуты.

```bash
cd /home/deploy/app
npm install
npm run build
```

Проверить:

```bash
ls dist/          # index.js
ls client/dist/   # index.html + assets/
```

---

## 8. Переменные окружения

```bash
cp /home/deploy/app/.env.example /home/deploy/app/.env
nano /home/deploy/app/.env
```

```env
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

DATABASE_URL=postgres://crocodile:СИЛЬНЫЙ_ПАРОЛЬ@localhost:5432/crocodile_db

REDIS_URL=redis://localhost:6379

ADMIN_TOKEN=<node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">

NER_SERVICE_URL=http://localhost:8001
NER_BATCH_SIZE=15
NER_TIMEOUT_MS=5000

FRONTEND_URL=https://ВАШ_ДОМЕН

VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@ВАШ_ДОМЕН
PUSH_THRESHOLD=5

MAX_RATE_LIMITERS=1000

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
CONTACT_EMAIL=
```

> `NER_BATCH_SIZE=15` вместо 10 — 2 воркера NER справятся с большим батчем.  
> `MAX_RATE_LIMITERS=1000` вместо 500 — памяти достаточно.

Сгенерировать токены:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npx web-push generate-vapid-keys
```

---

## 9. Миграции БД

```bash
cd /home/deploy/app
npx drizzle-kit migrate
```

```bash
psql -U crocodile -d crocodile_db -h localhost -c "\dt"
# 16+ таблиц
```

---

## 10. PM2 — запуск приложения

На 2 CPU запускаем Node.js в cluster-режиме с 2 инстансами. PM2 автоматически балансирует нагрузку между ними через встроенный load balancer.

```bash
mkdir -p /home/deploy/app/logs

cat > /home/deploy/app/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [
    {
      name: 'crocodile',
      script: '/home/deploy/app/dist/index.js',
      cwd: '/home/deploy/app',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      max_memory_restart: '1200M',
      env_file: '/home/deploy/app/.env',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '/home/deploy/app/logs/pm2-error.log',
      out_file: '/home/deploy/app/logs/pm2-out.log',
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
EOF
```

> **Важно:** cluster-режим PM2 использует Node.js `cluster` модуль — все инстансы слушают один порт 5000. WebSocket (`express-ws`) и глобальный `wss` в `server/index.ts` работают корректно только если sticky sessions настроены на уровне Nginx (см. раздел 11). Если возникают проблемы с WebSocket — вернуться к `instances: 1, exec_mode: 'fork'`.

```bash
cd /home/deploy/app
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
# Выполнить команду, которую выведет pm2 startup
```

Проверить:

```bash
pm2 status
curl http://localhost:5000/api/health
```

---

## 11. Nginx + SSL

### Установка

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx
```

### SSL-сертификат

```bash
sudo certbot --nginx -d ВАШ_ДОМЕН -d www.ВАШ_ДОМЕН
```

### Конфигурация

```bash
sudo nano /etc/nginx/sites-available/crocodile
```

```nginx
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
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    client_max_body_size 50M;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1024;

    access_log /var/log/nginx/crocodile_access.log;
    error_log  /var/log/nginx/crocodile_error.log;

    # Статика uploads
    location /uploads {
        alias /home/deploy/app/public/uploads;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Статические ассеты
    location ~* \.(css|js|mjs|woff2?|ttf|eot|png|jpg|jpeg|gif|ico|svg|webp)$ {
        root /home/deploy/app/client/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri @proxy;
    }

    # WebSocket — sticky session по IP для cluster-режима PM2
    location /ws {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # API
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60;
    }

    # SPA
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location @proxy {
        proxy_pass http://127.0.0.1:5000;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/crocodile /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Проверить автообновление сертификата:

```bash
sudo certbot renew --dry-run
```

---

## 12. Swap (страховка)

На 4 GB RAM swap не критичен, но защищает от OOM при пиковой нагрузке (одновременный сбор RSS + NER-батч + сборка при обновлении).

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Своп только при реальной нехватке памяти
echo 'vm.swappiness=5' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## 13. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

Порты 5000 и 8001 закрыты снаружи — доступны только локально.

---

## 14. Проверка работоспособности

```bash
pm2 status

curl https://ВАШ_ДОМЕН/api/health
curl http://localhost:8001/health

psql -U crocodile -d crocodile_db -h localhost -c "SELECT COUNT(*) FROM news_sources;"

redis-cli ping

sudo nginx -t
sudo systemctl status nginx

pm2 logs crocodile --lines 100

free -h
pm2 monit
```

---

## 15. Обновление приложения

```bash
# 1. Загрузить новый код (с локальной машины)
rsync -avz --exclude='node_modules' --exclude='.git' \
  --exclude='client/node_modules' --exclude='dist' \
  --exclude='client/dist' --exclude='logs' \
  --exclude='client — копия' --exclude='client — копия (2)' \
  D:/BlogPro/ deploy@<IP_СЕРВЕРА>:/home/deploy/app/

# 2. На сервере
cd /home/deploy/app
npm install
npm run build
npx drizzle-kit migrate

# 3. Zero-downtime перезапуск (cluster-режим)
pm2 reload crocodile
```

`pm2 reload` в cluster-режиме перезапускает инстансы по одному — даунтайма нет.

---

## 16. Мониторинг и логи

```bash
pm2 monit                          # интерактивный дашборд CPU + RAM
pm2 logs crocodile --lines 200
pm2 logs ner-service --lines 50

sudo tail -f /var/log/nginx/crocodile_access.log
sudo tail -f /var/log/nginx/crocodile_error.log

tail -f /home/deploy/app/logs/combined.log
tail -f /home/deploy/app/logs/error.log

htop       # CPU по ядрам, RAM
df -h      # диск (60 GB NVMe)
free -h
```

### Проверка использования диска

60 GB NVMe расходуется медленно, но стоит следить за ростом БД и логов:

```bash
du -sh /home/deploy/app/logs/
du -sh /var/lib/postgresql/
du -sh /home/deploy/backups/
```

---

## 17. Резервное копирование БД

### Ручной дамп

```bash
pg_dump -U crocodile -d crocodile_db -h localhost \
  -F c -f /home/deploy/backups/crocodile_$(date +%Y%m%d_%H%M%S).dump
```

### Автоматический бэкап через cron

```bash
mkdir -p /home/deploy/backups
crontab -e
```

Бэкап каждый день в 02:00, хранить 14 дней (60 GB позволяет):

```
0 2 * * * pg_dump -U crocodile -d crocodile_db -h localhost -F c -f /home/deploy/backups/crocodile_$(date +\%Y\%m\%d).dump && find /home/deploy/backups -name "*.dump" -mtime +14 -delete
```

### Восстановление

```bash
pg_restore -U crocodile -d crocodile_db -h localhost \
  -F c /home/deploy/backups/crocodile_20250507_020000.dump
```

---

## 18. Типичные проблемы

### WebSocket разрывается в cluster-режиме

PM2 cluster распределяет соединения между инстансами — повторный запрос может попасть на другой инстанс, где нет активного WS-соединения. Решение:

```bash
# Вернуться к одному инстансу
nano /home/deploy/app/ecosystem.config.cjs
# instances: 1, exec_mode: 'fork'
pm2 reload crocodile
```

### NER-сервис потребляет много памяти

2 воркера uvicorn = 2 копии модели natasha в памяти (~500–700 MB суммарно). Если памяти не хватает:

```bash
nano /home/deploy/app/ecosystem.config.cjs
# args: 'main:app --host 0.0.0.0 --port 8001 --workers 1'
pm2 restart ner-service
```

### PostgreSQL: `FATAL: password authentication failed`

```bash
sudo -u postgres psql -c "ALTER USER crocodile WITH PASSWORD 'НОВЫЙ_ПАРОЛЬ';"
pm2 restart crocodile
```

### Nginx: `502 Bad Gateway`

```bash
pm2 status
pm2 restart crocodile
curl http://localhost:5000/api/health
```

### Мало места на диске

```bash
df -h
pm2 flush                    # очистить логи PM2
npm cache clean --force      # очистить npm-кэш
# Найти большие файлы
du -sh /home/deploy/app/* | sort -rh | head -20
```

---

## Итоговая структура на сервере

```
/home/deploy/
├── app/                    # код приложения
│   ├── dist/               # скомпилированный сервер
│   ├── client/dist/        # скомпилированный клиент
│   ├── public/uploads/     # загруженные файлы
│   ├── logs/               # логи Winston + PM2
│   ├── .env
│   └── ecosystem.config.cjs
├── ner-service/
│   ├── venv/
│   └── main.py
└── backups/                # дампы PostgreSQL (14 дней)
```

---

## Распределение памяти (ориентир)

| Компонент | Потребление |
|-----------|-------------|
| Node.js × 2 инстанса | ~400–500 MB |
| NER-сервис × 2 воркера | ~500–700 MB |
| PostgreSQL | ~600–700 MB (с shared_buffers 512 MB) |
| Redis | ~50–100 MB |
| Nginx + ОС | ~200–300 MB |
| **Итого** | **~1.75–2.3 GB** |
| **Свободно** | **~1.7–2.25 GB** |

Запас ~1.7 GB — комфортная работа без свопа при любой нагрузке.

---

*Версия гайда: 1.0 · Май 2025 · Ubuntu 24.04 · Crocodile v2.1.0*
