# Эпизод 3: Готовность к производству

> **Статус:** ✅ Готов к записи
> **Документация:** 100% завершена
> **Код проверен:** Соответствует реальной реализации

---

## 📋 Что создано

1. **[script.md](./script.md)** — Детальный сценарий (25-30 минут)
2. **[diagrams-list.md](./diagrams-list.md)** — 6 диаграмм с ASCII-схемами
3. **[code-examples.md](./code-examples.md)** — Примеры кода из реального проекта
4. **[slides-outline.md](./slides-outline.md)** — 24 слайда презентации
5. **[recording-preparation.md](./recording-preparation.md)** — Чек-лист подготовки
6. **[interactive-elements.md](./interactive-elements.md)** — Вызовы и опросы

---

## 🎯 Ключевые сообщения эпизода

- **Последовательность** — for...of с 500ms, не Promise.allSettled
- **Функция, не класс** — parseSourceFeed без состояния
- **Один парсер** — RSS, Telegram, YouTube через sourceType
- **AlertManager независим** — опрашивает метрики каждые 30 сек, не вызывается из сбора
- **Redis + memory** — двухуровневый rate limiter с per-domain конфигами

---

## 📁 Файлы проекта для демонстрации

```
server/application/news/
  CollectNewsUseCase.ts
  RssCollectionService.ts
  ScheduleManagementService.ts
  ArticleManagementService.ts
  subscribers.ts

server/infrastructure/rss/
  RssParser.ts
  RssRateLimiter.ts

server/infrastructure/monitoring/
  AlertManager.ts
```

---

## 🚀 Следующие шаги

1. Создать диаграммы по [diagrams-list.md](./diagrams-list.md)
2. Подготовить презентацию по [slides-outline.md](./slides-outline.md)
3. Настроить среду по [recording-preparation.md](./recording-preparation.md)
4. Записать эпизод по [script.md](./script.md)

---

**Эпизод 3 готов к производству! 🚀**
