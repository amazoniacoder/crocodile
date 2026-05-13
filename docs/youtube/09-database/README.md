# Эпизод 9: Готовность к производству

> **Статус:** ✅ Готов к записи
> **Документация:** 100% завершена
> **Код проверен:** Соответствует реальной реализации

---

## 📋 Что создано

1. **[script.md](./script.md)** — Детальный сценарий (25-30 минут)
2. **[slides-outline.md](./slides-outline.md)** — 23 слайда, 4 блока + заключение
3. **[diagrams-list.md](./diagrams-list.md)** — 7 диаграмм архитектуры БД и кэша
4. **[demo-scenarios.md](./demo-scenarios.md)** — 6 сценариев демонстрации
5. **[code-examples.md](./code-examples.md)** — Примеры из реального кода (5 файлов)
6. **[interactive-elements.md](./interactive-elements.md)** — 3 вызова, 3 опроса, челлендж
7. **[recording-preparation.md](./recording-preparation.md)** — Чек-лист и порядок файлов

---

## 🎯 Ключевые сообщения

- **customType для tsvector** — Drizzle генерирует правильный DDL, TypeScript знает тип
- **18 таблиц** — ядро новостей, пользователи, реакции, аналитика, погода
- **dailyHash** — SHA256(IP+UA+date)[:16] — уникальные пользователи без хранения PII
- **onConflictDoNothing** — атомарная дедупликация по URL, нет race condition
- **Promise.all** — данные + COUNT параллельно, экономия ~50% времени
- **plainto_tsquery** — безопасный парсинг пользовательского ввода
- **jsonb_array_elements_text** — поиск по NER-сущностям в JSONB
- **Двухэтапное архивирование** — isArchived=true → физическое удаление через 14 дней
- **Redis → in-memory fallback** — ECONNREFUSED → graceful degradation
- **Теги + pipeline** — атомарная групповая инвалидация кэша
- **gzip > 1KB** — экономия 60-80% памяти Redis
- **stale-while-revalidate** — быстрый ответ + фоновое обновление

---

## 📁 Файлы проекта для демонстрации

```
shared/types/schema.ts
server/db/db.ts
server/db/redis.ts
server/infrastructure/persistence/NewsArticleRepository.ts
server/infrastructure/monitoring/QueryCacheService.ts
```

---

**Эпизод 9 готов к производству! 🚀**
