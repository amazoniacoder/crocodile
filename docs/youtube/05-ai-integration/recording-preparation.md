# Подготовка к записи Эпизода 5: "AI интеграция: NER и кластеризация"

---

## 📋 Файлы для демонстрации

```
server/
├── infrastructure/
│   ├── ner/
│   │   ├── NerService.ts           ← Блок 1: NER + Circuit Breaker
│   │   ├── GracefulNerService.ts   ← Блок 3: Graceful Degradation
│   │   └── NerBatchProcessor.ts    ← Блок 6: адаптивные батчи
│   └── patterns/
│       └── CircuitBreaker.ts       ← Блок 2: три состояния
├── application/news/
│   ├── ClusterNewsUseCase.ts       ← Блок 4: алгоритм кластеризации
│   └── EntityClusterService.ts     ← Блок 5: поиск похожих
└── domain/news/
    └── NewsCluster.ts              ← Блок 4: токенизация, стоп-слова
```

### Порядок открытия в VS Code
1. `NerService.ts` — показать extractBatch + circuitBreaker.execute()
2. `CircuitBreaker.ts` — показать три состояния и execute()
3. `GracefulNerService.ts` — показать processEntities + fallback стратегии
4. `NewsCluster.ts` — показать tokenize, STOP_WORDS, tokenizeNormalized
5. `ClusterNewsUseCase.ts` — показать clusterBucket + groupBySimilarity
6. `EntityClusterService.ts` — показать findSimilarArticles

---

## 🎬 Демо в браузере

### Подготовить перед записью
- [ ] Запустить NER-сервис: `docker-compose up ner-service`
- [ ] Убедиться что есть кластеры в БД
- [ ] Открыть карточку новости с "Похожие новости"
- [ ] Открыть Zone E (Hot Entities) в мониторинге

### Сценарии демонстрации

**Кластеры в UI:**
1. Открыть главную страницу
2. Найти карточку с меткой "Похожие новости"
3. Кликнуть → показать статьи из разных источников на одну тему

**Горячие сущности:**
1. Открыть `/admin/monitor` → Zone E
2. Показать топ-100 сущностей за 24 часа
3. Объяснить как они формируются

**Circuit Breaker в действии:**
```bash
# Остановить NER-сервис
docker-compose stop ner-service

# Запустить сбор — показать что система работает
curl -X POST http://localhost:5000/api/admin/jobs/collect \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Проверить метрики Circuit Breaker
curl http://localhost:5000/api/admin/ner/metrics \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Ручная кластеризация:**
```bash
curl -X POST http://localhost:5000/api/admin/cluster/run \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 🎯 Ключевые акценты

1. **Circuit Breaker** — показать что система работает без NER (graceful degradation)
2. **tokenizeNormalized** — DI через параметр, не через конструктор
3. **Bucket-разбивка** — объяснить зачем (оптимизация O(n²))
4. **MIN_COMMON_WORDS = 2** — показать на примере что это значит
5. **FIRST-сущность** — объяснить почему первая, а не все

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

*Подготовка обеспечит точное соответствие демонстрации реальному коду.*
