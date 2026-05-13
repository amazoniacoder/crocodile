# Эпизод 10: "Deployment и DevOps" — Сценарий

> **Длительность:** 25-30 минут  
> **Цель:** Показать production deployment с Docker и без Docker  
> **Аудитория:** DevOps инженеры, разработчики

---

## 🎬 Структура эпизода

### 1. Интро (2 мин)
- Что покажем: два способа деплоя — Docker и native
- Почему важно знать оба подхода
- Конфигурация сервера: Ubuntu 24.04, 2 CPU, 4 GB RAM

### 2. Теория (6 мин)
- Сравнение Docker vs Native deployment
- Архитектура production окружения
- Компоненты системы: Node.js, PostgreSQL, Redis, NER-сервис

### 3. Практика — Native Deployment (12 мин)
- Подготовка сервера Ubuntu 24.04
- Установка зависимостей
- Настройка PostgreSQL и Redis
- PM2 cluster режим
- Nginx + SSL

### 4. Практика — Docker Deployment (8 мин)
- Docker Compose конфигурация
- Сравнение производительности
- Когда использовать каждый подход

### 5. Заключение (2 мин)
- Выводы по производительности
- Рекомендации по выбору

---

## 📝 Детальный сценарий

### Интро

**[Экран: Заставка эпизода]**

Привет! В этом эпизоде мы развернем наш новостной агрегатор в production. Покажу два подхода — классический native deployment и современный Docker. Разберем, когда использовать каждый из них.

**[Экран: Схема архитектуры]**

Наша система состоит из:
- Node.js приложения в cluster режиме
- PostgreSQL 17 с оптимизацией под 4 GB RAM
- Redis для кэширования
- Python NER-сервиса для обработки текста
- Nginx как reverse proxy

### Теория: Docker vs Native

**[Экран: Сравнительная таблица]**

| Критерий | Native | Docker |
|----------|--------|--------|
| Производительность | 100% | 95-98% |
| Простота деплоя | Сложнее | Проще |
| Отладка | Прямой доступ | Через контейнеры |
| Ресурсы | Минимум | +overhead |
| Масштабирование | PM2 cluster | Kubernetes |

**[Экран: Архитектурная диаграмма]**

В production у нас:
- 2 инстанса Node.js через PM2
- 2 воркера NER-сервиса
- PostgreSQL с 512MB shared_buffers
- Redis с 512MB лимитом памяти

### Практика: Native Deployment

**[Экран: Терминал Ubuntu]**

Начнем с подготовки сервера:

```bash
# Обновляем систему
apt update && apt upgrade -y

# Создаем пользователя для приложения
adduser --disabled-password deploy
usermod -aG sudo deploy
```

**[Экран: Установка Node.js]**

```bash
# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs
node -v  # v20.x.x
```

**[Экран: PostgreSQL конфигурация]**

Устанавливаем PostgreSQL 17 и оптимизируем под 4 GB RAM:

```bash
# Установка
apt install -y postgresql-17

# Оптимизация в postgresql.conf
shared_buffers = 512MB
effective_cache_size = 1536MB
work_mem = 16MB
max_connections = 50
```

**[Экран: PM2 ecosystem.config.cjs]**

Ключевая особенность — cluster режим для 2 CPU:

```javascript
module.exports = {
  apps: [{
    name: 'crocodile',
    script: './dist/index.js',
    instances: 2,           // 2 CPU cores
    exec_mode: 'cluster',   // Load balancing
    max_memory_restart: '1200M'
  }, {
    name: 'ner-service',
    script: 'uvicorn',
    args: 'main:app --workers 2',  // 2 NER workers
    max_memory_restart: '600M'
  }]
};
```

**[Экран: Nginx конфигурация]**

Nginx с SSL и WebSocket поддержкой:

```nginx
# WebSocket — sticky session для cluster
location /ws {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}

# API и статика
location /api {
    proxy_pass http://127.0.0.1:5000;
}
```

**[Экран: Мониторинг htop]**

Проверяем распределение ресурсов:
- Node.js: ~500 MB (2 инстанса)
- NER-сервис: ~600 MB (2 воркера)
- PostgreSQL: ~700 MB
- Свободно: ~2 GB

### Практика: Docker Deployment

**[Экран: docker-compose.yml]**

Теперь тот же стек через Docker:

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
    deploy:
      replicas: 2
      
  postgres:
    image: postgres:17
    environment:
      POSTGRES_DB: crocodile_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    command: >
      postgres
      -c shared_buffers=512MB
      -c effective_cache_size=1536MB
      
  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 512mb
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

**[Экран: Dockerfile]**

Многоэтапная сборка для оптимизации:

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY dist ./dist
COPY client/dist ./client/dist
CMD ["node", "dist/index.js"]
```

**[Экран: Сравнение производительности]**

Запускаем нагрузочное тестирование:

```bash
# Native
ab -n 10000 -c 100 https://domain.com/api/articles
# Requests per second: 2847

# Docker
ab -n 10000 -c 100 https://domain.com/api/articles  
# Requests per second: 2734 (96% от native)
```

### Заключение

**[Экран: Рекомендации]**

**Используйте Native когда:**
- Максимальная производительность критична
- Простая архитектура (1-2 сервера)
- Команда знает системное администрирование

**Используйте Docker когда:**
- Нужно быстро масштабироваться
- Микросервисная архитектура
- CI/CD автоматизация
- Kubernetes в планах

**[Экран: Анонс следующего эпизода]**

В следующем эпизоде покажу горизонтальное масштабирование — как превратить один сервер в кластер с автоматическим failover.

---

## 🎥 Визуальные материалы

### Диаграммы для показа
1. **Архитектура production** — компоненты и связи
2. **Сравнение Native vs Docker** — таблица характеристик  
3. **Распределение памяти** — pie chart ресурсов
4. **PM2 cluster схема** — load balancing между инстансами

### Код для демонстрации
1. **ecosystem.config.cjs** — PM2 конфигурация
2. **nginx.conf** — reverse proxy настройки
3. **docker-compose.yml** — полный стек
4. **Dockerfile** — многоэтапная сборка

### Терминальные команды
1. **Установка зависимостей** — пошаговая установка
2. **PM2 мониторинг** — `pm2 monit`, `htop`
3. **Docker команды** — `docker-compose up`, `docker stats`
4. **Нагрузочное тестирование** — Apache Bench результаты

---

## 📊 Ключевые метрики для демонстрации

- **Время деплоя:** Native 15 мин, Docker 5 мин
- **Потребление RAM:** Native 2.3 GB, Docker 2.7 GB  
- **RPS:** Native 2847, Docker 2734
- **Время отклика:** Native 35ms, Docker 37ms
- **Размер образа:** 180 MB (multi-stage build)