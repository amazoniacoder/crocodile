# Гайд деплоя Crocodile на Ubuntu 24.04

> Сервер: Ubuntu 24.04 · 2 CPU · 4 GB RAM · 60 GB NVMe  
> Метод: терминал, без GitHub, без CI/CD  
> Стек: Node.js + PostgreSQL + Redis + NER (Python) + Nginx + PM2

---

## Отличия от конфигурации 1 CPU / 2 GB

| Параметр | 1 CPU / 2 GB | 2 CPU / 4 GB |
|----------|-------------|-------------|
| Swap | Обязателен (2 GB) | Рекомендован (1 GB, страховка) |
| Node.js instances | 1 (fork) | 1 (fork) |
| NER workers | 1 | 1 |
| Redis maxmemory | 256 MB | 512 MB |
| PostgreSQL shared_buffers | по умолчанию | 512 MB |
| PostgreSQL max_connections | 100 | 100 |
| PM2 max_memory_restart | 800 MB | 1.2 GB |
| Сборка | ~5–7 мин | ~2–3 мин |
| Ротация логов | logrotate | logrotate |
| ulimit nofile | 65536 | 65536 |

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
13. [Ротация логов](#13-ротация-логов)
14. [ulimit — лимит открытых файлов](#14-ulimit--лимит-открытых-файлов)
15. [Firewall](#15-firewall)
16. [Проверка работоспособности](#16-проверка-работоспособности)
17. [Обновление приложения](#17-обновление-приложения)
18. [Мониторинг и логи](#18-мониторинг-и-логи)
19. [Резервное копирование БД](#19-резервное-копирование-бд)
20. [Типичные проблемы](#20-типичные-проблемы)

---

## 1. Подготовка сервера

Подключаемся к серверу по SSH от имени root — это первый вход после получения сервера от хостинга:

```bash
# root — суперпользователь, <IP_СЕРВЕРА> — IP из панели хостинга
ssh root@193.233.130.53
```

Обновляем список пакетов и сами пакеты до актуальных версий, затем устанавливаем базовые утилиты:

```bash
# apt update    — обновить список доступных пакетов (не сами пакеты, только индекс)
# apt upgrade   — установить новые версии уже установленных пакетов
# -y            — автоматически отвечать «да» на все вопросы
apt update && apt upgrade -y

# curl   — скачивать файлы из интернета (нужен для установки Node.js)
# wget   — альтернатива curl, тоже скачивает файлы
# git    — система контроля версий (может понадобиться для отладки)
# unzip  — распаковка .zip архивов
# build-essential — компиляторы C/C++ (нужны для сборки нативных npm-пакетов)
# software-properties-common — утилиты для добавления сторонних репозиториев
# htop   — интерактивный мониторинг CPU и RAM в терминале
apt install -y curl wget git unzip build-essential software-properties-common htop
```

Создаём отдельного пользователя `deploy` для запуска приложения — никогда не запускаем сервер от root, это угроза безопасности:

```bash
# --disabled-password — пользователь без пароля (вход только через sudo или su)
# --gecos ""          — пропустить вопросы про имя/телефон/офис
adduser --disabled-password --gecos "" deploy


# Добавляем deploy в группу sudo — чтобы мог выполнять команды с sudo
usermod -aG sudo deploy

# Переключаемся на пользователя deploy — все дальнейшие команды от его имени
su - deploy
```

---

## 2. Установка зависимостей

### Node.js 20.x

Ubuntu не знает о существовании Node.js 20 — нужно добавить официальный репозиторий NodeSource:

```bash
# Скачиваем скрипт настройки репозитория NodeSource и сразу запускаем его
# -f  — не выводить ошибку если сервер недоступен
# -s  — без прогресс-бара
# -L  — следовать редиректам
# sudo -E bash - — запускаем скрипт через bash с правами root, сохраняя переменные окружения
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Теперь устанавливаем Node.js 20 из добавленного репозитория
sudo apt install -y nodejs

# Проверяем версию — должно быть v20.x.x
node -v
```

### Python 3.11

NER-сервис написан на Python. Устанавливаем сам Python, инструмент создания виртуальных окружений и pip:

```bash
# python3.11        — сам интерпретатор
# python3.11-venv   — инструмент для создания изолированных окружений (venv)
# python3-pip       — менеджер пакетов Python
sudo apt install -y python3.11 python3.11-venv python3-pip
```

### PM2

PM2 — менеджер процессов для Node.js. Автоматически перезапускает приложение при падении, сохраняет логи, запускается при старте сервера:

```bash
# -g — установить глобально (доступно из любой директории)
sudo npm install -g pm2
```

---

## 3. PostgreSQL

### Установка PostgreSQL 17

Ubuntu по умолчанию содержит старую версию PostgreSQL. Добавляем официальный репозиторий PGDG для установки версии 17:

```bash
# Устанавливаем вспомогательный пакет для добавления репозитория PGDG
sudo apt install -y postgresql-common

# Запускаем скрипт, который добавляет официальный репозиторий PostgreSQL в систему
# -y — автоматически принять все вопросы
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y

# Устанавливаем сам PostgreSQL 17
sudo apt install -y postgresql-17
```

### Настройка пользователя и БД

```bash
# Включаем автозапуск PostgreSQL при старте сервера
sudo systemctl enable postgresql

# Запускаем сервис сейчас
sudo systemctl start postgresql

# Открываем консоль psql от имени системного пользователя postgres
# (он создаётся автоматически при установке и является администратором БД)
sudo -u postgres psql
```

Внутри консоли psql выполняем SQL-команды:

```sql
-- Создаём пользователя БД с паролем — от его имени будет работать приложение
CREATE USER admin WITH PASSWORD 'NoogenNagen19811981*!';

-- Создаём базу данных и сразу назначаем её владельцем пользователя crocodile
CREATE DATABASE "Porto1" OWNER admin;

-- Даём пользователю все права на эту БД
GRANT ALL PRIVILEGES ON DATABASE Porto1 TO admin;

-- Выходим из psql
\q
```

### Оптимизация под 4 GB RAM

По умолчанию PostgreSQL настроен очень консервативно. Открываем файл конфигурации и даём ему больше памяти:

```bash
# nano — простой текстовый редактор в терминале. Сохранить: Ctrl+O, выйти: Ctrl+X
sudo nano /etc/postgresql/17/main/postgresql.conf
```

Найти и изменить следующие параметры:

```
# Объём оперативной памяти для кэширования данных — ~12% от всей RAM
shared_buffers = 512MB

# Подсказка планировщику запросов, сколько памяти доступно для кэша (включая OS)
effective_cache_size = 1536MB

# Память для сортировки/хэшей на один запрос — важно для полнотекстового поиска
work_mem = 16MB

# Память для операций обслуживания (создание индексов, VACUUM)
maintenance_work_mem = 128MB

# Максимальное число одновременных подключений к БД
# Node.js pool=10 + NER + системные = ~30, запас до 100
max_connections = 100
```

sed -i \
  -e 's/^#*\s*shared_buffers\s*=.*/shared_buffers = 512MB/' \
  -e 's/^#*\s*effective_cache_size\s*=.*/effective_cache_size = 1536MB/' \
  -e 's/^#*\s*work_mem\s*=.*/work_mem = 16MB/' \
  -e 's/^#*\s*maintenance_work_mem\s*=.*/maintenance_work_mem = 128MB/' \
  -e 's/^#*\s*max_connections\s*=.*/max_connections = 100/' \
  /etc/postgresql/17/main/postgresql.conf

```bash
# Перезапускаем PostgreSQL чтобы новые настройки вступили в силу
sudo systemctl restart postgresql
```
Проверяем что подключение работает:

```bash
# -U admin — пользователь
# -d Porto1 — база данных
# -h localhost — подключаться через TCP (не Unix-сокет)
# -c "..." — выполнить одну команду и выйти
psql -U admin -d Porto1 -h localhost -c "SELECT version();"
```

---

## 4. Redis

Redis — быстрое хранилище в памяти. Используется как кэш для API-ответов, rate limiting и distributed-локи планировщика:

```bash
# Устанавливаем Redis из стандартного репозитория Ubuntu
sudo apt install -y redis-server
```

Открываем конфиг и ограничиваем потребление памяти:

```bash
sudo nano /etc/redis/redis.conf
```

Найти и изменить / добавить:

```
# Максимальный объём памяти для Redis — не даём ему расти бесконтрольно
maxmemory 512mb

# Политика вытеснения: удалять самые давно не используемые ключи при нехватке памяти
maxmemory-policy allkeys-lru

# Отключаем сохранение на диск — нам не нужно восстанавливать кэш после перезапуска
save ""

# Отключаем AOF-лог (журнал всех операций) — не нужен для кэша, только ест диск
appendonly no
```

```bash

sed -i \
  -e 's/^#*\s*maxmemory\s.*/maxmemory 512mb/' \
  -e 's/^#*\s*maxmemory-policy\s.*/maxmemory-policy allkeys-lru/' \
  -e 's/^#*\s*appendonly\s.*/appendonly no/' \
  /etc/redis/redis.conf

#Параметр save "" особый — его нужно добавить отдельно, так как в конфиге может быть несколько строк save:

sed -i '/^save /d' /etc/redis/redis.conf
echo 'save ""' >> /etc/redis/redis.conf

#Проверить:
grep -E "^maxmemory|^maxmemory-policy|^appendonly|^save" /etc/redis/redis.conf


# Включаем автозапуск и перезапускаем с новыми настройками
sudo systemctl enable redis-server
sudo systemctl restart redis-server

# Проверяем что Redis отвечает — должно вернуть PONG
redis-cli ping
```

---

## 5. NER-сервис (Python)

NER-сервис — отдельный FastAPI-процесс на порту 8001. Он принимает заголовки статей и возвращает именованные сущности (персоны, организации, локации) через natasha + pymorphy2. Запускаем 1 воркер — достаточно для текущей нагрузки и экономит ~250 MB RAM. При необходимости можно увеличить до 2 (см. раздел 20).

```bash
# Создаём директорию для NER-сервиса
mkdir -p /home/deploy/ner-service
cd /home/deploy/ner-service

# Создаём изолированное Python-окружение (venv) — чтобы пакеты NER
# не конфликтовали с системными пакетами Python
python3.11 -m venv venv

#Python 3.11 не установлен. Установите и повторите:

apt install software-properties-common -y
add-apt-repository ppa:deadsnakes/ppa -y
apt update
apt install python3.11 python3.11-venv -y


python3.11 -m venv venv
source venv/bin/activate

# Устанавливаем зависимости NER-сервиса:
# fastapi   — веб-фреймворк для API
# uvicorn   — ASGI-сервер, запускает FastAPI
# natasha   — библиотека NER для русского языка
# pymorphy2 — морфологический анализатор (нормализация слов)
pip install fastapi uvicorn natasha pymorphy2

# Деактивируем окружение — возвращаемся к системному Python
deactivate
```

После загрузки кода (шаг 6) копируем точку входа сервиса:

```bash
# Копируем main.py из проекта в директорию NER-сервиса
cp /home/deploy/app/ner-service/main.py /home/deploy/ner-service/main.py
```

---

## 6. Загрузка кода на сервер

### Вариант A — rsync (рекомендуется)

rsync передаёт только изменившиеся файлы — при повторных деплоях работает быстро. Выполняем на **локальной машине** (Windows — через WSL или Git Bash):

```bash
# rsync — синхронизация файлов между машинами по SSH
# -a — архивный режим: сохраняет права, время изменения, рекурсивно
# -v — verbose: показывает какие файлы передаются
# -z — сжимать данные при передаче (экономит трафик)
# --exclude — не передавать эти директории (node_modules весит сотни MB, dist пересоберём на сервере)
# D:/BlogPro/ — источник (локальная папка проекта, слэш в конце важен — копирует содержимое, не саму папку)
# deploy@<IP>:/home/deploy/app/ — куда копировать на сервере
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

Если rsync недоступен. На **локальной машине**:

```bash
# tar — создаём архив проекта, исключая лишнее
# -c — создать архив
# -z — сжать через gzip
# -f blogpro.tar.gz — имя файла архива
# --exclude — не включать эти папки
# -C D:/BlogPro — перейти в эту папку перед архивированием
# . — архивировать текущую директорию (т.е. содержимое D:/BlogPro)
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

# scp — копирование файлов по SSH (Secure Copy)
scp blogpro.tar.gz deploy@<IP_СЕРВЕРА>:/home/deploy/
```

На **сервере**:

```bash
# Создаём директорию для приложения (-p — не ругаться если уже существует)
mkdir -p /home/deploy/app
cd /home/deploy

# Распаковываем архив в папку app/
# -x — извлечь
# -z — разжать gzip
# -f — имя файла
# -C app/ — распаковать в эту директорию
tar -xzf blogpro.tar.gz -C app/

# Удаляем архив — он больше не нужен
rm blogpro.tar.gz
```

---

## 7. Сборка приложения

На 2 CPU сборка занимает 2–3 минуты. Выполняем на сервере:

```bash
# Переходим в директорию проекта
cd /home/deploy/app

# Устанавливаем все npm-зависимости из package.json
# На сервере это займёт 1–2 минуты при первом запуске
npm install

# Запускаем сборку: Vite собирает React-клиент в client/dist/,
# esbuild компилирует TypeScript-сервер в dist/index.js
npm run build
```

Проверяем что сборка прошла успешно:

```bash
# Должен быть файл index.js — скомпилированный сервер
ls dist/

# Должны быть index.html и папка assets/ — скомпилированный клиент
ls client/dist/
```

---

## 8. Переменные окружения

Копируем шаблон и открываем для редактирования:

```bash
# cp — копировать файл. Копируем шаблон .env.example в рабочий .env
cp /home/deploy/app/.env.example /home/deploy/app/.env

# Открываем .env в редакторе nano для заполнения значений
nano /home/deploy/app/.env
```

Заполняем переменные:

```env
# Режим работы — production отключает отладочные логи и включает оптимизации
NODE_ENV=production

# Порт на котором слушает Node.js (Nginx проксирует на него)
PORT=5000

# Слушать на всех сетевых интерфейсах (не только localhost)
HOST=0.0.0.0

# Строка подключения к PostgreSQL — пользователь:пароль@хост:порт/база
DATABASE_URL=postgres://crocodile:СИЛЬНЫЙ_ПАРОЛЬ@localhost:5432/crocodile_db

# Строка подключения к Redis
REDIS_URL=redis://localhost:6379

# Секретный токен для доступа в админку — генерируем ниже
ADMIN_TOKEN=<сгенерировать>

# URL NER-сервиса (запущен локально на порту 8001)
NER_SERVICE_URL=http://localhost:8001

# Сколько заголовков отправлять в NER за один запрос
NER_BATCH_SIZE=10

# Таймаут ожидания ответа от NER в миллисекундах
NER_TIMEOUT_MS=5000

# Публичный URL сайта — используется для CORS и Web Push
FRONTEND_URL=https://ВАШ_ДОМЕН

# VAPID-ключи для Web Push уведомлений — генерируем ниже
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@ВАШ_ДОМЕН

# Минимум новых статей для отправки Web Push
PUSH_THRESHOLD=5

# Максимум активных rate-limiter объектов в памяти
MAX_RATE_LIMITERS=1000

# SMTP для контактной формы (опционально)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
CONTACT_EMAIL=
```

Генерируем секретные значения:

```bash
# Генерируем ADMIN_TOKEN — 32 случайных байта в hex-формате (64 символа)
# Вставить результат в .env как значение ADMIN_TOKEN
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Генерируем пару VAPID-ключей для Web Push
# Вставить PUBLIC_KEY и PRIVATE_KEY в соответствующие переменные .env
npx web-push generate-vapid-keys
```

---

## 9. Миграции БД

Migrations создают все таблицы в БД по схеме из `shared/types/schema.ts`. Без этого шага приложение упадёт при старте:

```bash
# Переходим в директорию проекта
cd /home/deploy/app

# Drizzle Kit читает файлы из drizzle/ и применяет их к БД последовательно
# Создаёт 16+ таблиц: news_articles, news_sources, collection_stats и др.
npx drizzle-kit migrate
```

Проверяем что таблицы созданы:

```bash
# \dt — команда psql для вывода списка таблиц
# Должно быть 16+ таблиц
psql -U crocodile -d crocodile_db -h localhost -c "\dt"
```

---

## 10. PM2 — запуск приложения

Запускаем Node.js в fork-режиме с 1 инстансом — это гарантирует корректную работу WebSocket (`express-ws` с глобальным `wss` несовместим с cluster-режимом PM2).

```bash
# Создаём директорию для логов приложения
mkdir -p /home/deploy/app/logs

# Создаём файл конфигурации PM2 командой heredoc (cat > файл << 'EOF' ... EOF)
# Всё между 'EOF' и EOF записывается в файл как есть
cat > /home/deploy/app/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [
    {
      name: 'crocodile',                          // имя процесса в pm2 status
      script: '/home/deploy/app/dist/index.js',   // что запускать
      cwd: '/home/deploy/app',                    // рабочая директория
      instances: 1,                               // один процесс (fork-режим)
      exec_mode: 'fork',                          // fork = один процесс, не кластер
      autorestart: true,                          // перезапускать при падении
      max_memory_restart: '1200M',                // перезапустить если съел > 1.2 GB
      env_file: '/home/deploy/app/.env',          // загрузить переменные из .env
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '/home/deploy/app/logs/pm2-error.log',  // stderr в этот файл
      out_file: '/home/deploy/app/logs/pm2-out.log',      // stdout в этот файл
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'ner-service',
      script: '/home/deploy/ner-service/venv/bin/uvicorn', // uvicorn из venv
      args: 'main:app --host 0.0.0.0 --port 8001 --workers 1',
      cwd: '/home/deploy/ner-service',
      interpreter: 'none',           // не оборачивать в node, запускать напрямую
      autorestart: true,
      max_memory_restart: '400M',
      env: { PYTHONPATH: '/home/deploy/ner-service' }
    }
  ]
};
EOF
```

```bash
cd /home/deploy/app

# Запускаем все процессы из ecosystem.config.cjs
pm2 start ecosystem.config.cjs

# Сохраняем список процессов — PM2 восстановит их после перезагрузки сервера
pm2 save

# Генерируем команду для автозапуска PM2 при старте ОС
# pm2 startup выведет команду вида: sudo env PATH=... pm2 startup ...
# Нужно скопировать и выполнить эту команду!
pm2 startup
```

Проверяем что всё запустилось:

```bash
# Показывает статус всех процессов: имя, статус, CPU, RAM, uptime
pm2 status

# Проверяем что API отвечает
curl http://localhost:5000/api/health
```

---

## 11. Nginx + SSL

Nginx — обратный прокси. Принимает все входящие запросы на 80/443 и передаёт их Node.js на порт 5000. Также отдаёт статику напрямую, минуя Node.js.

### Установка

```bash
# nginx               — сам веб-сервер / reverse proxy
# certbot             — инструмент получения SSL-сертификатов Let's Encrypt
# python3-certbot-nginx — плагин certbot для автонастройки nginx
sudo apt install -y nginx certbot python3-certbot-nginx

# Включаем автозапуск nginx при старте сервера
sudo systemctl enable nginx
```

### SSL-сертификат

```bash
# Certbot получает бесплатный SSL-сертификат от Let's Encrypt
# --nginx        — автоматически настроить nginx для HTTPS
# -d ВАШ_ДОМЕН   — для какого домена выпустить сертификат
# Certbot сам проверит что домен указывает на этот сервер (через порт 80)
sudo certbot --nginx -d ВАШ_ДОМЕН -d www.ВАШ_ДОМЕН
```

### Конфигурация

Создаём конфиг для нашего сайта:

```bash
# sites-available — папка со всеми конфигами (активными и нет)
sudo nano /etc/nginx/sites-available/crocodile
```

```nginx
# Блок 1: перенаправляем HTTP → HTTPS (301 — постоянный редирект)
server {
    listen 80;
    server_name ВАШ_ДОМЕН www.ВАШ_ДОМЕН;
    return 301 https://ВАШ_ДОМЕН$request_uri;
}

# Блок 2: перенаправляем www → основной домен без www
server {
    listen 443 ssl http2;
    server_name www.ВАШ_ДОМЕН;
    ssl_certificate /etc/letsencrypt/live/ВАШ_ДОМЕН/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ВАШ_ДОМЕН/privkey.pem;
    return 301 https://ВАШ_ДОМЕН$request_uri;
}

# Блок 3: основной сервер — обрабатывает все реальные запросы
server {
    listen 443 ssl http2;   # слушаем HTTPS, http2 — более быстрый протокол
    server_name ВАШ_ДОМЕН;

    # Пути к SSL-сертификату и приватному ключу от Let's Encrypt
    ssl_certificate /etc/letsencrypt/live/ВАШ_ДОМЕН/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ВАШ_ДОМЕН/privkey.pem;

    # Разрешаем только современные протоколы TLS
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Кэшируем SSL-сессии — повторные подключения быстрее
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Максимальный размер тела запроса (для загрузки файлов)
    client_max_body_size 50M;

    # Сжимаем ответы — экономим трафик и ускоряем загрузку
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1024;  # сжимать только файлы > 1 KB

    # Логи запросов и ошибок nginx
    access_log /var/log/nginx/crocodile_access.log;
    error_log  /var/log/nginx/crocodile_error.log;

    # Статика uploads — отдаём файлы напрямую с диска, минуя Node.js
    location /uploads {
        alias /home/deploy/app/public/uploads;
        expires 1y;   # браузер кэширует на 1 год
        add_header Cache-Control "public, immutable";
    }

    # Статические ассеты (CSS, JS, шрифты, картинки) — тоже с диска
    # ~* — регулярное выражение без учёта регистра
    location ~* \.(css|js|mjs|woff2?|ttf|eot|png|jpg|jpeg|gif|ico|svg|webp)$ {
        root /home/deploy/app/client/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri @proxy;  # если файл не найден — передать в Node.js
    }

    # WebSocket — особый проксинг: нужно передать заголовки Upgrade/Connection
    location /ws {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;      # сигнал на апгрейд до WS
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;     # передаём реальный IP клиента
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;  # 24 часа — WS-соединение долгоживущее
    }

    # API — проксируем запросы /api/* в Node.js
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60;
    }

    # SPA — все остальные запросы идут в Node.js (он отдаёт index.html)
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Именованный location для fallback статики
    location @proxy {
        proxy_pass http://127.0.0.1:5000;
    }
}
```

```bash
# Активируем конфиг — создаём символическую ссылку из sites-enabled на sites-available
sudo ln -s /etc/nginx/sites-available/crocodile /etc/nginx/sites-enabled/

# Удаляем дефолтный конфиг nginx (он занимает порт 80)
sudo rm -f /etc/nginx/sites-enabled/default

# Проверяем синтаксис конфига — должно быть «syntax is ok» и «test is successful»
sudo nginx -t

# Перезагружаем nginx без остановки (применяем новый конфиг)
sudo systemctl reload nginx
```

Проверяем автообновление сертификата (certbot добавляет cron автоматически):

```bash
# --dry-run — симуляция без реального обновления
sudo certbot renew --dry-run
```

---

## 12. Swap (страховка)

Swap — это раздел на диске, который ОС использует как «запасную RAM» когда реальная память заканчивается. На 4 GB не критичен, но защищает от OOM (Out Of Memory) при пиковой нагрузке.

```bash
# fallocate — выделить файл заданного размера на диске
# -l 1G — размер 1 гигабайт
# /swapfile — путь к файлу подкачки
sudo fallocate -l 1G /swapfile

# Устанавливаем права 600 — файл подкачки должен быть доступен только root
# Иначе Linux откажется его использовать
sudo chmod 600 /swapfile

# Форматируем файл как swap-раздел
sudo mkswap /swapfile

# Активируем swap прямо сейчас (без перезагрузки)
sudo swapon /swapfile

# Добавляем в /etc/fstab — чтобы swap монтировался автоматически при перезагрузке
# tee -a — добавить строку в конец файла
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# vm.swappiness=5 — ОС будет уходить в swap только при реальной нехватке памяти
# (по умолчанию 60 — слишком агрессивно для сервера)
echo 'vm.swappiness=5' | sudo tee -a /etc/sysctl.conf

# Применяем параметры ядра без перезагрузки
sudo sysctl -p
```

---

## 13. Ротация логов

Без ротации логи Winston и PM2 вырастают до нескольких GB за месяц. logrotate — системный инструмент Ubuntu, который автоматически архивирует и удаляет старые логи по расписанию.

```bash
# Создаём конфиг ротации для нашего приложения
# /etc/logrotate.d/ — директория где хранятся все конфиги logrotate
sudo nano /etc/logrotate.d/crocodile
```

```
# Применять ко всем .log файлам в директории логов приложения
/home/deploy/app/logs/*.log {
    daily          # ротировать ежедневно
    rotate 14      # хранить 14 последних архивов (2 недели)
    compress       # сжимать архивы через gzip
    delaycompress  # не сжимать самый свежий архив (он может ещё писаться)
    missingok      # не ругаться если файл не найден
    notifempty     # не ротировать пустые файлы
    copytruncate   # скопировать файл и обнулить оригинал — не нужно перезапускать процесс
}
```

Проверяем что конфиг корректен:

```bash
# --debug — показать что будет сделано, но не делать реально
sudo logrotate --debug /etc/logrotate.d/crocodile
```

---

## 14. ulimit — лимит открытых файлов

Каждое TCP-соединение, файл лога, сокет — это «открытый файл» с точки зрения Linux. По умолчанию лимит 1024 — при высокой нагрузке Node.js упрётся в него и начнёт отклонять соединения.

```bash
# limits.conf — файл где задаются системные лимиты для пользователей
sudo nano /etc/security/limits.conf
```

Добавить в конец файла:

```
# deploy — имя пользователя
# soft   — мягкий лимит (пользователь может поднять до hard самостоятельно)
# hard   — жёсткий лимит (потолок, выше не поднять без root)
# nofile — лимит на количество открытых файлов/сокетов
deploy soft nofile 65536
deploy hard nofile 65536
```

```bash
# Лимиты применяются только при новом входе в сессию
# Выходим и заходим обратно
exit
su - deploy

# Проверяем — должно быть 65536
ulimit -n
```

---

## 15. Firewall

ufw (Uncomplicated Firewall) — простой инструмент управления правилами iptables. Закрываем всё лишнее, оставляем только SSH и веб.

```bash
# Разрешаем SSH — ОБЯЗАТЕЛЬНО до включения firewall
# Иначе потеряем доступ к серверу!
sudo ufw allow OpenSSH

# Разрешаем HTTP (80) и HTTPS (443) через Nginx
# 'Nginx Full' — предустановленный профиль, открывает оба порта
sudo ufw allow 'Nginx Full'

# Включаем firewall
sudo ufw enable

# Проверяем правила — должны быть OpenSSH и Nginx Full со статусом ALLOW
sudo ufw status
```

Порты 5000 (Node.js) и 8001 (NER) не открываем — они доступны только локально через Nginx.

---

## 16. Проверка работоспособности

Проверяем каждый компонент по очереди:

```bash
# Статус всех PM2-процессов: crocodile и ner-service должны быть online
pm2 status

# Проверяем API через публичный домен (через Nginx + SSL)
curl https://ВАШ_ДОМЕН/api/health

# Проверяем NER-сервис напрямую (локально)
curl http://localhost:8001/health

# Проверяем PostgreSQL — должен вернуть количество источников
psql -U crocodile -d crocodile_db -h localhost -c "SELECT COUNT(*) FROM news_sources;"

# Проверяем Redis — должен вернуть PONG
redis-cli ping

# Проверяем синтаксис конфига Nginx
sudo nginx -t

# Проверяем что Nginx запущен
sudo systemctl status nginx

# Смотрим последние 100 строк логов приложения
pm2 logs crocodile --lines 100

# Проверяем использование RAM: должно быть ~1.3–1.75 GB занято
free -h

# Интерактивный дашборд PM2: CPU и RAM каждого процесса в реальном времени
pm2 monit
```

---

## 17. Обновление приложения

При каждом обновлении кода выполняем на **локальной машине**, затем на **сервере**:

```bash
# ШАГ 1 — на локальной машине: отправляем только изменившиеся файлы
rsync -avz --exclude='node_modules' --exclude='.git' \
  --exclude='client/node_modules' --exclude='dist' \
  --exclude='client/dist' --exclude='logs' \
  --exclude='client — копия' --exclude='client — копия (2)' \
  D:/BlogPro/ deploy@<IP_СЕРВЕРА>:/home/deploy/app/
```

```bash
# ШАГ 2 — на сервере: переходим в директорию проекта
cd /home/deploy/app

# Устанавливаем новые зависимости если изменился package.json
npm install

# Пересобираем клиент и сервер
npm run build

# Применяем новые миграции БД если они появились
npx drizzle-kit migrate

# ШАГ 3 — перезапускаем приложение
# pm2 reload — graceful restart: сначала запускает новый процесс,
# дожидается его готовности, затем останавливает старый
pm2 reload crocodile
```

---

## 18. Мониторинг и логи

```bash
# Интерактивный дашборд PM2: CPU и RAM каждого процесса, обновляется в реальном времени
pm2 monit

# Последние 200 строк логов приложения (stdout + stderr)
pm2 logs crocodile --lines 200

# Последние 50 строк логов NER-сервиса
pm2 logs ner-service --lines 50

# Лог всех входящих запросов к Nginx (IP, URL, статус, время)
sudo tail -f /var/log/nginx/crocodile_access.log

# Лог ошибок Nginx (502, 504 и т.д.)
sudo tail -f /var/log/nginx/crocodile_error.log

# Общий лог приложения (Winston) — все уровни: info, warn, error
tail -f /home/deploy/app/logs/combined.log

# Только ошибки приложения
tail -f /home/deploy/app/logs/error.log

# htop — интерактивный просмотр процессов, CPU по ядрам, RAM
htop

# df -h — сколько места занято/свободно на дисках (-h = human readable)
df -h

# free -h — использование оперативной памяти и swap
free -h
```

### Проверка использования диска

```bash
# du -sh — размер директории (-s = суммарно, -h = читаемый формат)
# Смотрим где растут данные
du -sh /home/deploy/app/logs/      # логи приложения
du -sh /var/lib/postgresql/        # данные PostgreSQL
du -sh /home/deploy/backups/       # дампы БД
```

---

## 19. Резервное копирование БД

### Ручной дамп

```bash
# pg_dump — утилита создания дампа PostgreSQL
# -U crocodile     — пользователь БД
# -d crocodile_db  — база данных
# -h localhost     — подключение через TCP
# -F c             — формат custom (сжатый, поддерживает выборочное восстановление)
# -f               — путь к файлу дампа
# $(date +%Y%m%d_%H%M%S) — подставляет текущую дату и время в имя файла
pg_dump -U crocodile -d crocodile_db -h localhost \
  -F c -f /home/deploy/backups/crocodile_$(date +%Y%m%d_%H%M%S).dump
```

### Автоматический бэкап через cron

```bash
# Создаём директорию для бэкапов
mkdir -p /home/deploy/backups

# Открываем редактор cron-задач текущего пользователя
crontab -e
```

Добавляем строку — бэкап каждый день в 02:00, хранить 14 дней:

```
# Формат cron: минута час день месяц день_недели команда
# 0 2 * * * = в 02:00 каждый день
# && — выполнить вторую команду только если первая успешна
# find ... -mtime +14 -delete — удалить файлы старше 14 дней
0 2 * * * pg_dump -U crocodile -d crocodile_db -h localhost -F c -f /home/deploy/backups/crocodile_$(date +\%Y\%m\%d).dump && find /home/deploy/backups -name "*.dump" -mtime +14 -delete
```

### Восстановление из дампа

```bash
# pg_restore — восстановление из дампа формата custom (-F c)
# Используем если нужно откатиться к конкретной дате
pg_restore -U crocodile -d crocodile_db -h localhost \
  -F c /home/deploy/backups/crocodile_20250507_020000.dump
```

---

## 20. Типичные проблемы

### NER-сервис нужна большая пропускная способность

1 воркер = ~250–350 MB RAM. Если статей много и NER не успевает — увеличиваем до 2 воркеров:

```bash
# Открываем конфиг PM2
nano /home/deploy/app/ecosystem.config.cjs
# Меняем в блоке ner-service:
# args: 'main:app --host 0.0.0.0 --port 8001 --workers 2'
# max_memory_restart: '600M'

# Перезапускаем только NER без остановки основного приложения
pm2 restart ner-service
```

### PostgreSQL: `FATAL: password authentication failed`

Пароль в `.env` не совпадает с паролем пользователя в БД:

```bash
# Меняем пароль пользователя в PostgreSQL
sudo -u postgres psql -c "ALTER USER crocodile WITH PASSWORD 'НОВЫЙ_ПАРОЛЬ';"

# Обновляем DATABASE_URL в .env и перезапускаем приложение
nano /home/deploy/app/.env
pm2 restart crocodile
```

### Nginx: `502 Bad Gateway`

Nginx не может достучаться до Node.js на порту 5000 — приложение упало или не запущено:

```bash
# Смотрим статус — crocodile должен быть online
pm2 status

# Перезапускаем если упал
pm2 restart crocodile

# Проверяем что API отвечает локально
curl http://localhost:5000/api/health
```

### Мало места на диске

```bash
# Смотрим общую картину по дискам
df -h

# pm2 flush — удаляет все накопленные логи PM2 (out.log, error.log)
pm2 flush

# Очищаем кэш npm (может занимать сотни MB)
npm cache clean --force

# Находим самые большие директории — ищем где растёт мусор
# sort -rh — сортировка по размеру по убыванию
# head -20 — показать топ-20
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
| Node.js × 1 инстанс | ~200–300 MB |
| NER-сервис × 1 воркер | ~250–350 MB |
| PostgreSQL | ~600–700 MB (с shared_buffers 512 MB) |
| Redis | ~50–100 MB |
| Nginx + ОС | ~200–300 MB |
| **Итого** | **~1.3–1.75 GB** |
| **Свободно** | **~2.25–2.7 GB** |

Запас ~2.25 GB — комфортная работа без свопа при любой нагрузке.

---

*Версия гайда: 1.1 · Май 2025 · Ubuntu 24.04 · Crocodile v2.1.0*
