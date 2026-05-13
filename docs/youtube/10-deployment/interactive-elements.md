# Интерактивные элементы для Эпизода 10

---

## 🎯 Вызовы

### Вызов 1: Multi-stage build
**Время:** После объяснения Dockerfile (15 минута)

```
🐳 Вопрос:

Почему в production образе нет TypeScript исходников,
хотя мы их копировали в стадии builder?

A) COPY --from=builder копирует только dist/
B) TypeScript удаляется автоматически после сборки
C) Стадия builder — временная, не входит в финальный образ
D) .dockerignore исключает .ts файлы

Что происходит с builder стадией после сборки?
```

**Правильный ответ:** C — каждая стадия FROM создаёт отдельный слой. Финальный образ начинается с `FROM node:20-alpine` (вторая стадия) и содержит только то, что явно скопировано через `COPY --from=builder`.

---

### Вызов 2: PM2 cluster vs fork
**Время:** После объяснения WebSocket проблемы (20 минута)

```
⚙️ Ситуация:

Приложение развёрнуто с PM2 cluster (instances: 2).
Пользователи жалуются что WebSocket уведомления
приходят не всегда.

Какое БЫСТРОЕ решение?

A) instances: 1, exec_mode: 'fork'
B) Добавить Redis pub/sub для WS broadcast
C) Настроить ip_hash в Nginx
D) Увеличить instances до 4

Какое решение ПРАВИЛЬНОЕ долгосрочно?
```

**Правильный ответ:** Быстрое — A. Правильное долгосрочно — B (Redis pub/sub) или C (sticky sessions). В проекте реализован WebSocketManager с broadcastToCluster через Redis.

---

### Вызов 3: depends_on в Docker Compose
**Время:** После объяснения docker-compose.yml (22 минута)

```
🐳 docker-compose.yml:
  app:
    depends_on: [db, redis]

Гарантирует ли depends_on что PostgreSQL
готов принимать соединения когда стартует app?

A) Да — Docker ждёт пока db полностью готов
B) Нет — только порядок запуска контейнеров
C) Да — если использовать healthcheck
D) Нет — нужен wait-for-it.sh скрипт

Как это решено в проекте?
(подсказка: server/db/db.ts — checkDatabaseConnection)
```

**Правильный ответ:** B — `depends_on` гарантирует только порядок запуска. В проекте решено через retry с экспоненциальной задержкой (1s → 2s → 4s) в `checkDatabaseConnection()`.

---

## 📊 Опросы

### Опрос 1: Метод деплоя
**Время:** В начале (2 минута)

```
🚀 Как деплоите свои проекты?

A) Docker / Docker Compose
B) PM2 + Nginx (bare-metal)
C) Kubernetes
D) PaaS (Heroku, Railway, Render)
```

### Опрос 2: CI/CD
**Время:** После блока обновления (23 минута)

```
🔄 Как обновляете production?

A) GitHub Actions / GitLab CI
B) Вручную (rsync / scp)
C) Capistrano / Deployer
D) Нет автоматизации
```

### Опрос 3: Бэкапы
**Время:** После блока бэкапов (25 минута)

```
💾 Как часто делаете бэкапы БД?

A) Каждый день (автоматически)
B) Раз в неделю
C) Перед каждым деплоем
D) Не делаю бэкапы 😅
```

---

## 🎮 Челлендж недели

```
🚀 Челлендж: "Задеплой своё приложение"

Задача:
Задеплой любое своё Node.js приложение
на VPS используя PM2 + Nginx.

Минимальные требования:
  • PM2 с autorestart
  • Nginx как reverse proxy
  • Firewall (ufw)
  • Проверить pm2 status

Бонус:
  • SSL через Let's Encrypt
  • pm2 startup (автозапуск)
  • Автоматические бэкапы через cron

Покажите pm2 status в комментариях! 🖥️
```

---

## 💬 Темы для обсуждения

1. Bare-metal vs Docker — что выбрать для небольшого проекта?
2. Как решить проблему WebSocket в PM2 cluster без Redis?
3. Стоит ли использовать Docker на VPS с 2 GB RAM?
4. Как организовать zero-downtime деплой без PM2?
5. GFS ротация бэкапов vs простое хранение 14 дней — когда нужна?
