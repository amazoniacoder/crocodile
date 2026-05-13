# Эпизод 5: Готовность к производству

> **Статус:** ✅ Готов к записи
> **Документация:** 100% завершена
> **Код проверен:** Соответствует реальной реализации

---

## 📋 Что создано

1. **[script.md](./script.md)** — Детальный сценарий (25-30 минут)
2. **[diagrams-list.md](./diagrams-list.md)** — 6 диаграмм
3. **[code-examples.md](./code-examples.md)** — Примеры из реального кода
4. **[slides-outline.md](./slides-outline.md)** — 22 слайда
5. **[recording-preparation.md](./recording-preparation.md)** — Чек-лист и демо-сценарии
6. **[interactive-elements.md](./interactive-elements.md)** — Вызовы и опросы

---

## 🎯 Ключевые сообщения

- **NER-сервис** — Python FastAPI + Natasha, батчи по 10, таймаут 5 сек
- **Circuit Breaker** — 3 состояния, `forOptionalService` для NER (мягкие пороги)
- **Graceful Degradation** — 4 уровня: NER → simple regex → keyword → empty
- **tokenizeNormalized** — DI через параметр, graceful degradation в Domain Layer
- **Bucket-разбивка** — оптимизация O(n²) по region:category
- **MIN_COMMON_WORDS = 2** — порог похожести заголовков
- **Entity-Driven** — FIRST-сущность → cluster_id → категория

---

## 📁 Файлы проекта для демонстрации

```
server/infrastructure/ner/NerService.ts
server/infrastructure/ner/GracefulNerService.ts
server/infrastructure/ner/NerBatchProcessor.ts
server/infrastructure/patterns/CircuitBreaker.ts
server/application/news/ClusterNewsUseCase.ts
server/application/news/EntityClusterService.ts
server/domain/news/NewsCluster.ts
```

---

**Эпизод 5 готов к производству! 🚀**
