# Подготовка к записи Эпизода 10: "Deployment и DevOps"

---

## 📋 Файлы для демонстрации

```
Dockerfile                          ← Блок 3: multi-stage build
ner-service/Dockerfile              ← Блок 3: Python NER образ
docker-compose.yml                  ← Блок 3: базовый compose
docker-compose.cluster.yml          ← Блок 3: кластерный compose
docs/guide/DEPLOY_GUIDE_4GB.md      ← Блок 2: bare-metal гайд
```

### Порядок открытия в VS Code
1. `docs/guide/DEPLOY_GUIDE_4GB.md` — обзор всего гайда, таблица сравнения
2. `Dockerfile` — показать multi-stage: builder → production
3. `ner-service/Dockerfile` — показать минимальный Python образ
4. `docker-compose.yml` — показать базовый стек, depends_on
5. `docker-compose.cluster.yml` — показать два app-node, rsshub, networks

### Терминал — показать вживую
```bash
# Размер образа после сборки
docker build -t crocodile:latest .
docker images crocodile

# Запуск compose
docker-compose up -d
docker-compose ps
docker-compose logs app --tail=20
```

---

## 🎬 Подготовить перед записью

### Локально
- [ ] Docker Desktop запущен
- [ ] `docker build -t crocodile:latest .` — образ уже собран (показать размер)
- [ ] `docker-compose config` — проверить синтаксис compose файлов

### VS Code
- [ ] Открыть все 5 файлов в отдельных вкладках
- [ ] Шрифт 16px, minimap отключён, word wrap включён

### Терминал
- [ ] Docker доступен: `docker --version`
- [ ] Compose доступен: `docker-compose --version`

---

## 🎯 Ключевые акценты

1. **Multi-stage build** — builder (~800MB) → production (~150MB), в 5 раз меньше
2. **depends_on ≠ готовность** — только порядок запуска; retry в db.ts решает проблему
3. **PM2 cluster + WebSocket** — проблема sticky sessions; быстрое решение: fork mode
4. **pm2 reload vs pm2 restart** — reload = zero-downtime, restart = даунтайм
5. **shared_buffers = 512MB** — 1/8 RAM, не больше; effective_cache_size — только подсказка
6. **Redis save ""** — кэш не нужно персистить, восстановится из БД
7. **Firewall** — только 22, 80, 443; 5000/8001/5432/6379 закрыты снаружи
8. **rsync --exclude** — не передаём node_modules, .git, dist (экономия трафика)
9. **docker-compose.cluster.yml** — два app-node + rsshub + cluster-network
10. **./drizzle:/docker-entrypoint-initdb.d** — автомиграции при первом старте PostgreSQL

---

## 🎬 Сценарии демонстрации

### Docker build
```bash
docker build -t crocodile:latest .
docker images crocodile
# → показать SIZE ~148MB
```

### Docker Compose
```bash
docker-compose up -d
docker-compose ps
docker-compose logs app --tail=20
docker-compose exec app curl http://localhost:5000/api/health
```

### PM2 (на сервере или симуляция)
```bash
pm2 status
pm2 reload crocodile  # zero-downtime
pm2 logs crocodile --lines 30
```

### Nginx проверка
```bash
sudo nginx -t
curl -I https://ВАШ_ДОМЕН/api/health | head -5
```

---

## ⚙️ Настройки VS Code для записи

```json
{
  "editor.fontSize": 16,
  "editor.fontFamily": "JetBrains Mono",
  "editor.minimap.enabled": false,
  "editor.wordWrap": "on",
  "workbench.colorTheme": "Dark+ (default dark)"
}
```

---

## ✅ Чек-лист перед записью

- [ ] Docker Desktop запущен
- [ ] Образ `crocodile:latest` собран (`docker images crocodile`)
- [ ] `docker-compose config` — нет ошибок синтаксиса
- [ ] Все 5 файлов открыты в VS Code
- [ ] DEPLOY_GUIDE_4GB.md открыт для ссылок
- [ ] Микрофон проверен
- [ ] Уведомления системы отключены

---

*Подготовка обеспечит точное соответствие демонстрации реальному коду.*
