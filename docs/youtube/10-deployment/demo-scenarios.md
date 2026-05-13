# Сценарии демонстрации для Эпизода 10: "Deployment и DevOps"

---

## 🎬 Демо 1: Multi-stage Docker build

### Сценарий
```bash
# Сборка образа
docker build -t crocodile:latest .

# Показать размер финального образа
docker images crocodile
# REPOSITORY   TAG       IMAGE ID       SIZE
# crocodile    latest    abc123def456   148MB

# Сравнить с образом без multi-stage (если есть)
# Показать что 148MB vs ~800MB

# Посмотреть слои образа
docker history crocodile:latest

# Запустить контейнер локально
docker run -p 5000:5000 \
  -e DATABASE_URL=postgres://... \
  -e REDIS_URL=redis://... \
  crocodile:latest
```

---

## 🎬 Демо 2: Docker Compose — запуск стека

### Сценарий
```bash
# Запустить весь стек
docker-compose up -d

# Проверить статус
docker-compose ps
# NAME                STATUS          PORTS
# blogpro-app-1       Up 2 minutes    0.0.0.0:5000->5000/tcp
# blogpro-db-1        Up 2 minutes    5432/tcp
# blogpro-redis-1     Up 2 minutes    6379/tcp
# blogpro-nginx-1     Up 2 minutes    0.0.0.0:80->80/tcp

# Логи приложения
docker-compose logs app --tail=30

# Миграции
docker-compose exec app npx drizzle-kit migrate

# Проверить health
docker-compose exec app curl http://localhost:5000/api/health

# Остановить
docker-compose down
```

---

## 🎬 Демо 3: Docker Compose cluster

### Сценарий
```bash
# Кластерный запуск
docker-compose -f docker-compose.cluster.yml up -d

# Показать два app-node
docker-compose -f docker-compose.cluster.yml ps
# blogpro-app-node-1-1   Up
# blogpro-app-node-2-1   Up
# blogpro-postgres-1     Up
# blogpro-redis-1        Up
# blogpro-rsshub-1       Up

# Логи обоих нод
docker-compose -f docker-compose.cluster.yml logs app-node-1 --tail=20
docker-compose -f docker-compose.cluster.yml logs app-node-2 --tail=20

# Обновление без даунтайма
docker-compose -f docker-compose.cluster.yml build app-node-1 app-node-2
docker-compose -f docker-compose.cluster.yml up -d --no-deps app-node-1 app-node-2
```

---

## 🎬 Демо 4: PM2 — статус и мониторинг (на сервере)

### Сценарий
```bash
# Статус всех процессов
pm2 status
# ┌─────┬──────────────┬─────────┬──────┬───────────┬──────────┐
# │ id  │ name         │ mode    │ ↺    │ status    │ cpu      │
# ├─────┼──────────────┼─────────┼──────┼───────────┼──────────┤
# │ 0   │ crocodile    │ cluster │ 0    │ online    │ 0%       │
# │ 1   │ crocodile    │ cluster │ 0    │ online    │ 0%       │
# │ 2   │ ner-service  │ fork    │ 0    │ online    │ 0%       │
# └─────┴──────────────┴─────────┴──────┴───────────┴──────────┘

# Интерактивный мониторинг
pm2 monit

# Логи в реальном времени
pm2 logs crocodile --lines 50

# Zero-downtime перезапуск
pm2 reload crocodile
# [PM2] Reloading process crocodile with id 0
# [PM2] Process 0 successfully reloaded
# [PM2] Reloading process crocodile with id 1
# [PM2] Process 1 successfully reloaded
```

---

## 🎬 Демо 5: Nginx — проверка конфигурации

### Сценарий
```bash
# Проверить конфигурацию
sudo nginx -t
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Перезагрузить без даунтайма
sudo systemctl reload nginx

# Проверить SSL
curl -I https://ВАШ_ДОМЕН/api/health
# HTTP/2 200
# x-cache: MISS

# Проверить редирект HTTP → HTTPS
curl -I http://ВАШ_ДОМЕН
# HTTP/1.1 301 Moved Permanently
# Location: https://ВАШ_ДОМЕН/

# Проверить автообновление SSL
sudo certbot renew --dry-run
```

---

## 🎬 Демо 6: Бэкапы и восстановление

### Сценарий
```bash
# Создать бэкап
pg_dump -U crocodile -d crocodile_db -h localhost \
  -F c -f /home/deploy/backups/demo_backup.dump

# Проверить размер
ls -lh /home/deploy/backups/
# -rw-r--r-- 1 deploy deploy 45M May 15 10:30 demo_backup.dump

# Показать crontab
crontab -l
# 0 2 * * * pg_dump -U crocodile ...

# Проверить что бэкап валиден
pg_restore --list /home/deploy/backups/demo_backup.dump | head -20

# Мониторинг диска
df -h
# Filesystem      Size  Used Avail Use%
# /dev/sda1        59G   12G   44G  22%
du -sh /home/deploy/backups/
```

---

## ⚙️ Команды для подготовки

```bash
# Локально — проверить Docker
docker --version
docker-compose --version

# Собрать образ
docker build -t crocodile:test .
docker images crocodile:test

# Проверить docker-compose.yml синтаксис
docker-compose config

# Проверить cluster compose
docker-compose -f docker-compose.cluster.yml config
```
