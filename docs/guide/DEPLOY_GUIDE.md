# Гайд деплоя Crocodile на Ubuntu 24.04

> Сервер: Ubuntu 24.04 · 1 CPU · 2 GB RAM · 30 GB SSD  
> Метод: терминал, без GitHub, без CI/CD  
> Стек: Node.js + PostgreSQL + Redis + NER (Python) + Nginx + PM2

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
12. [Swap (важно для 2 GB RAM)](#12-swap-важно-для-2-gb-ram)
13. [Firewall](#13-firewall)
14. [Проверка работоспособности](#14-проверка-работоспособности)
15. [Обновление приложения](#15-обновление-приложения)
16. [Мониторинг и логи](#16-мониторинг-и-логи)
17. [Резервное копирование БД](#17-резервное-копирование-бд)
18. [Типичные проблемы](#18-типичные-проблемы)

---

## 1. Подготовка сервера

Подключиться к серверу:

```bash
ssh root@<IP_СЕРВЕРА>
```

Обновить систему:

```bash
apt update && apt upgrade -y
apt install -y curl wget git unzip build-essential software-properties-common
```

Создать системного пользователя для приложения (не запускать от root):

```bash
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
```

Переключиться на пользователя:

```bash
su - deploy
```

---

## 2. Установка зависимостей

### Node.js 20.x

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # должно быть v20.x.x
npm -v
```

### Python 3.11 + pip (для NER-сервиса)

```bash
sudo apt install -y python3.11 python3.11-venv python3-pip
python3.11 --version
```

### PM2 (менеджер процессов)

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

### Настройка

```bash
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo -u postgres psql
```

Внутри psql:

```sql
CREATE USER crocodile WITH PASSWORD 'СИЛЬНЫЙ_ПАРОЛЬ';
CREATE DATABASE crocodile_db OWNER crocodile;
GRANT ALL PRIVILEGES ON DATABASE crocodile_db TO crocodile;
\q
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

Настроить Redis для экономии памяти (важно при 2 GB RAM):

```bash
sudo nano /etc/redis/redis.conf
```

Найти и изменить / добавить:

```
maxmemory 256mb
maxmemory-policy allkeys-lru
save ""
appendonly no
```

```bash
sudo systemctl enable redis-server
sudo systemctl restart redis-server
redis-cli ping   # должно вернуть PONG
```

---

## 5. NER-сервис (Python)

NER-сервис — отдельный FastAPI-процесс на порту 8001. Запускается через PM2.

### Создать директорию и виртуальное окружение

```bash
mkdir -p /home/deploy/ner-service
cd /home/deploy/ner-service
python3.11 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn natasha pymorphy2
deactivate
```

### Скопировать main.py

Файл `ner-service/main.py` из проекта нужно загрузить на сервер (см. раздел 6).  
После загрузки кода:

```bash
cp /home/deploy/app/ner-service/main.py /home/deploy/ner-service/main.py
```

### PM2-конфиг для NER

```bash
cat > /home/deploy/ner-service/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'ner-service',
    script: '/home/deploy/ner-service/venv/bin/uvicorn',
    args: 'main:app --host 0.0.0.0 --port 8001 --workers 1',
    cwd: '/home/deploy/ner-service',
    interpreter: 'none',
    autorestart: true,
    max_memory_restart: '300M',
    env: { PYTHONPATH: '/home/deploy/ner-service' }
  }]
};
EOF
```

> NER-сервис запустим после загрузки кода (шаг 10).

---

## 6. Загрузка кода на сервер

Код передаётся через `scp` или `rsync` с локальной машины.

### Вариант A — rsync (рекомендуется, передаёт только изменения)

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
# Создать архив (исключить лишнее)
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

# Загрузить на сервер
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

На сервере 1 CPU / 2 GB RAM — сборка занимает 3–7 минут. Swap обязателен (см. раздел 12).

```bash
cd /home/deploy/app

# Установить зависимости
npm install

# Собрать клиент и сервер
npm run build
```

Убедиться что сборка прошла успешно:

```bash
ls dist/          # должен быть index.js
ls client/dist/   # должны быть index.html и assets/
```

---

## 8. Переменные окружения

```bash
cp /home/deploy/app/.env.example /home/deploy/app/.env
nano /home/deploy/app/.env
```

Минимальная конфигурация для production:

```env
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

DATABASE_URL=postgres://crocodile:СИЛЬНЫЙ_ПАРОЛЬ@localhost:5432/crocodile_db

REDIS_URL=redis://localhost:6379

ADMIN_TOKEN=<сгенерировать: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">

NER_SERVICE_URL=http://localhost:8001
NER_BATCH_SIZE=10
NER_TIMEOUT_MS=5000

# Домен
FRONTEND_URL=https://ВАШ_ДОМЕН

# Web Push (генерация: npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@ВАШ_ДОМЕН
PUSH_THRESHOLD=5

# Rate limiting
MAX_RATE_LIMITERS=500

# SMTP (опционально, для контактной формы)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
CONTACT_EMAIL=
```

Сгенерировать ADMIN_TOKEN:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Сгенерировать VAPID-ключи:

```bash
cd /home/deploy/app
npx web-push generate-vapid-keys
```

Вставить результат в `.env`.

---

## 9. Миграции БД

```bash
cd /home/deploy/app
npx drizzle-kit migrate
```

Проверить таблицы:

```bash
psql -U crocodile -d crocodile_db -h localhost -c "\dt"
```

Должно быть 16+ таблиц.

---

## 10. PM2 — запуск приложения

### Создать ecosystem.config.cjs

```bash
cat > /home/deploy/app/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [
    {
      name: 'crocodile',
      script: '/home/deploy/app/dist/index.js',
      cwd: '/home/deploy/app',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '800M',
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
      args: 'main:app --host 0.0.0.0 --port 8001 --workers 1',
      cwd: '/home/deploy/ner-service',
      interpreter: 'none',
      autorestart: true,
      max_memory_restart: '300M',
      env: { PYTHONPATH: '/home/deploy/ner-service' }
    }
  ]
};
EOF
```

### Создать директорию логов

```bash
mkdir -p /home/deploy/app/logs
```

### Запустить

```bash
cd /home/deploy/app
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Команда `pm2 startup` выведет строку — выполнить её (она начинается с `sudo env PATH=...`).

### Проверить статус

```bash
pm2 status
pm2 logs crocodile --lines 50
```

Проверить API:

```bash
curl http://localhost:5000/api/health
```

---

## 11. Nginx + SSL

### Установка Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### Получить SSL-сертификат (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ВАШ_ДОМЕН -d www.ВАШ_ДОМЕН
```

Certbot автоматически настроит Nginx для HTTPS.

### Конфигурация Nginx

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

    client_max_body_size 50M;

    access_log /var/log/nginx/crocodile_access.log;
    error_log  /var/log/nginx/crocodile_error.log;

    # Статика uploads
    location /uploads {
        alias /home/deploy/app/public/uploads;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Статические ассеты (хэшированные имена — кэш навсегда)
    location ~* \.(css|js|mjs|woff2?|ttf|eot|png|jpg|jpeg|gif|ico|svg|webp)$ {
        root /home/deploy/app/client/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri @proxy;
    }

    # WebSocket
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

    # SPA — всё остальное
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

Активировать конфиг:

```bash
sudo ln -s /etc/nginx/sites-available/crocodile /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### Автообновление сертификата

Certbot добавляет cron автоматически. Проверить:

```bash
sudo certbot renew --dry-run
```

---

## 12. Swap (важно для 2 GB RAM)

На 2 GB RAM сборка Node.js и работа NER-сервиса могут исчерпать память. Swap обязателен.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Сделать постоянным
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Снизить агрессивность свопирования
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

Проверить:

```bash
free -h
# Должна появиться строка Swap: 2.0G
```

---

## 13. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

Порты 5000 (Node.js) и 8001 (NER) должны быть закрыты снаружи — они доступны только локально через Nginx.

---

## 14. Проверка работоспособности

```bash
# Статус процессов
pm2 status

# API health
curl https://ВАШ_ДОМЕН/api/health

# NER health
curl http://localhost:8001/health

# PostgreSQL
psql -U crocodile -d crocodile_db -h localhost -c "SELECT COUNT(*) FROM news_sources;"

# Redis
redis-cli ping

# Nginx
sudo nginx -t
sudo systemctl status nginx

# Логи приложения
pm2 logs crocodile --lines 100

# Использование памяти
free -h
pm2 monit
```

---

## 15. Обновление приложения

При каждом обновлении кода:

```bash
# 1. Загрузить новый код (с локальной машины)
rsync -avz --exclude='node_modules' --exclude='.git' \
  --exclude='client/node_modules' --exclude='dist' \
  --exclude='client/dist' --exclude='logs' \
  --exclude='client — копия' --exclude='client — копия (2)' \
  D:/BlogPro/ deploy@<IP_СЕРВЕРА>:/home/deploy/app/

# 2. На сервере
cd /home/deploy/app

# 3. Установить новые зависимости (если изменился package.json)
npm install

# 4. Пересобрать
npm run build

# 5. Применить новые миграции (если есть)
npx drizzle-kit migrate

# 6. Перезапустить без даунтайма
pm2 reload crocodile
```

---

## 16. Мониторинг и логи

### PM2

```bash
pm2 monit                          # интерактивный дашборд
pm2 logs                           # все логи в реальном времени
pm2 logs crocodile --lines 200     # последние 200 строк
pm2 logs ner-service --lines 50
```

### Nginx

```bash
sudo tail -f /var/log/nginx/crocodile_access.log
sudo tail -f /var/log/nginx/crocodile_error.log
```

### Системные ресурсы

```bash
htop          # CPU + RAM (установить: sudo apt install htop)
df -h         # дисковое пространство
free -h       # память
```

### Логи приложения (Winston)

```bash
tail -f /home/deploy/app/logs/combined.log
tail -f /home/deploy/app/logs/error.log
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

Добавить строку (бэкап каждый день в 02:00, хранить 7 дней):

```
0 2 * * * pg_dump -U crocodile -d crocodile_db -h localhost -F c -f /home/deploy/backups/crocodile_$(date +\%Y\%m\%d).dump && find /home/deploy/backups -name "*.dump" -mtime +7 -delete
```

### Восстановление из дампа

```bash
pg_restore -U crocodile -d crocodile_db -h localhost \
  -F c /home/deploy/backups/crocodile_20250507_020000.dump
```

---

## 18. Типичные проблемы

### `npm run build` падает с OOM (out of memory)

Убедиться что swap создан (раздел 12). Если не помогает:

```bash
export NODE_OPTIONS="--max-old-space-size=1536"
npm run build
```

### NER-сервис не запускается

```bash
pm2 logs ner-service --lines 50
# Проверить что зависимости установлены
cd /home/deploy/ner-service
source venv/bin/activate
python -c "import natasha, pymorphy2; print('OK')"
```

### PostgreSQL: `FATAL: password authentication failed`

```bash
sudo -u postgres psql -c "ALTER USER crocodile WITH PASSWORD 'НОВЫЙ_ПАРОЛЬ';"
# Обновить DATABASE_URL в .env
pm2 restart crocodile
```

### Nginx: `502 Bad Gateway`

Приложение не запущено или упало:

```bash
pm2 status
pm2 restart crocodile
curl http://localhost:5000/api/health
```

### Порт 5000 уже занят

```bash
sudo lsof -i :5000
sudo kill -9 <PID>
pm2 start ecosystem.config.cjs
```

### Сертификат Let's Encrypt не выдаётся

Убедиться что домен указывает на IP сервера:

```bash
dig +short ВАШ_ДОМЕН
# Должен вернуть IP сервера
```

Порт 80 должен быть открыт и Nginx запущен до запуска certbot.

### Мало места на диске

```bash
df -h
# Очистить логи PM2
pm2 flush
# Очистить npm-кэш
npm cache clean --force
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
│   ├── .env                # переменные окружения
│   └── ecosystem.config.cjs
├── ner-service/            # NER Python-сервис
│   ├── venv/
│   └── main.py
└── backups/                # дампы PostgreSQL
```

---

*Версия гайда: 1.0 · Май 2025 · Ubuntu 24.04 · Crocodile v2.1.0*
