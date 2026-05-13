# Подготовка к записи Эпизода 9: "База данных и производительность"

---

## 📋 Файлы для демонстрации

```
shared/types/schema.ts                              ← Блок 1: 18 таблиц, типы
server/db/db.ts                                     ← Блок 1: Pool, retry
server/db/redis.ts                                  ← Блок 4: graceful degradation
server/infrastructure/persistence/
  NewsArticleRepository.ts                          ← Блок 2+3: поиск, фильтрация, архив
server/infrastructure/monitoring/
  QueryCacheService.ts                              ← Блок 4: двухуровневый кэш
```

### Порядок открытия в VS Code
1. `schema.ts` — показать customType, jsonb, UNIQUE, onDelete, dailyHash
2. `db.ts` — показать Pool min:2, retry с экспоненциальной задержкой
3. `redis.ts` — показать graceful degradation при ECONNREFUSED
4. `NewsArticleRepository.ts` — показать insert (onConflictDoNothing)
5. `NewsArticleRepository.ts` — показать findMany (Promise.all + динамические условия)
6. `NewsArticleRepository.ts` — показать search (plainto_tsquery, ts_rank)
7. `NewsArticleRepository.ts` — показать findByEntities (jsonb_array_elements_text)
8. `NewsArticleRepository.ts` — показать archiveOlderThan / deleteOlderThan
9. `QueryCacheService.ts` — показать get (Redis → memory), set (gzip), invalidateByTags

---

## 🎬 Подготовить перед записью

### Браузер
- [ ] DevTools → Network → включить запись
- [ ] Открыть `/api/news` — убедиться что работает

### Терминал
- [ ] Приложение запущено: `npm run dev`
- [ ] `export ADMIN_TOKEN=<токен>`
- [ ] Проверить поиск: `curl -s "http://localhost:5000/api/news/search?q=тест" | jq '.total'`
- [ ] Проверить кэш: `curl -s -I "http://localhost:5000/api/news" | grep -i x-cache`

### VS Code
- [ ] Открыть все 5 файлов в отдельных вкладках
- [ ] Шрифт 16px, minimap отключён, word wrap включён

---

## 🎯 Ключевые акценты

1. **customType для tsvector** — Drizzle не знает этот тип, создаём сами; генерирует правильный DDL
2. **onDelete: 'set null'** — осознанное решение: исторические данные важнее ссылочной целостности
3. **onConflictDoNothing** — атомарная дедупликация, нет race condition
4. **Promise.all для данных + COUNT** — экономия ~50% времени запроса
5. **plainto_tsquery безопасен** — не нужно экранировать пользовательский ввод
6. **jsonb_array_elements_text** — разворачивает JSON-массив для поиска по NER
7. **Двухэтапное архивирование** — 14 дней на восстановление данных
8. **Redis pipeline для тегов** — атомарное обновление, нет частичных состояний
9. **gzip > 1KB** — экономия 60-80% памяти Redis для больших ответов
10. **stale-while-revalidate** — пользователь всегда получает быстрый ответ

---

## 🎬 Сценарии демонстрации

### Поиск
```bash
curl -s "http://localhost:5000/api/news/search?q=Путин" | jq '.total'
time curl -s "http://localhost:5000/api/news/search?q=Байден" > /dev/null
```

### Кэш заголовки
```bash
# MISS → HIT
curl -s -I "http://localhost:5000/api/news?page=1" | grep -i x-cache
curl -s -I "http://localhost:5000/api/news?page=1" | grep -i x-cache
```

### Статистика кэша
```bash
curl -s http://localhost:5000/api/admin/cache/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.stats.hitRate'
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

- [ ] Приложение запущено, `/api/health` отвечает
- [ ] Поиск работает: `curl "...?q=тест"` возвращает результаты
- [ ] Кэш работает: второй запрос даёт `X-Cache: HIT`
- [ ] ADMIN_TOKEN экспортирован
- [ ] Все 5 файлов открыты в VS Code
- [ ] Микрофон проверен
- [ ] Уведомления системы отключены

---

*Подготовка обеспечит точное соответствие демонстрации реальному коду.*
