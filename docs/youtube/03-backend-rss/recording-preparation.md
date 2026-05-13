# Подготовка к записи Эпизода 3: "Backend: RSS сбор и обработка"

> **Цель:** Обеспечить качественную запись без технических проблем

---

## 📋 Чек-лист подготовки

### ✅ Файлы для демонстрации

```
server/
├── application/news/
│   ├── CollectNewsUseCase.ts       ← Блок 1: оркестрация
│   ├── RssCollectionService.ts     ← Блок 1: сбор одного источника
│   ├── ScheduleManagementService.ts ← Блок 2: планировщик
│   ├── ArticleManagementService.ts ← Блок 3: сохранение
│   └── subscribers.ts              ← Блок 5: подписчики
├── infrastructure/
│   ├── rss/
│   │   ├── RssParser.ts            ← Блок 3: парсинг
│   │   └── RssRateLimiter.ts       ← Блок 4: rate limiting
│   ├── monitoring/
│   │   └── AlertManager.ts         ← Блок 5: алерты
│   └── events/
│       └── EventBus.ts             ← Блок 1: события
└── domain/
    ├── news/NewsArticle.ts         ← типы
    └── events/ArticlesCollected.ts ← тип события
```

### ✅ Порядок открытия файлов в VS Code

1. `CollectNewsUseCase.ts` — показать execute() и processSources()
2. `RssCollectionService.ts` — показать collectFromSource() и classifyError()
3. `RssParser.ts` — показать parseSourceFeed() и strict/lenient парсеры
4. `RssRateLimiter.ts` — показать canMakeRequest() и DEFAULT_CONFIGS
5. `AlertManager.ts` — показать initializeDefaultRules() и checkAlertConditions()
6. `subscribers.ts` — показать initCacheSubscriber() и initWebSocketSubscriber()

### ✅ Настройки VS Code для записи

```json
{
  "editor.fontSize": 16,
  "editor.fontFamily": "JetBrains Mono",
  "editor.minimap.enabled": false,
  "breadcrumbs.enabled": false,
  "editor.wordWrap": "on",
  "workbench.colorTheme": "Dark+ (default dark)"
}
```

### ✅ Что показать в терминале

```bash
# Логи реального сбора
tail -f server/logs/combined.log | grep "CollectNewsUseCase\|RssCollection"

# Метрики Prometheus (если запущен)
curl http://localhost:5000/api/metrics | grep rss_

# Статус rate limiter
curl http://localhost:5000/api/admin/rss/rate-limits \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 🎬 Сценарий записи по блокам

### Блок 1: Архитектура (6 мин)
**Сцена:** Slides → Code (CollectNewsUseCase.ts)

Показать:
- Диаграмму потока данных
- `execute()` — защита от параллельного запуска
- `processSources()` — for...of с delay(500)
- `emitCollectionEvent()` — событие в конце

**Ключевая фраза:** "Последовательно, не параллельно — это осознанное решение"

### Блок 2: Планировщик (2 мин)
**Сцена:** Code (ScheduleManagementService.ts)

Показать:
- `initialize()` — загрузка из БД
- `startSchedule()` — два cron-задания
- `isCycleRunning()` — защита от overlap

### Блок 3: parseSourceFeed (8 мин)
**Сцена:** Code (RssParser.ts)

Показать:
- Два инстанса парсера на уровне модуля
- `parseSourceFeed()` — strict → lenient fallback
- `isXmlError()` — только XML-ошибки вызывают fallback
- Ветку `sourceType === 'telegram'` — извлечение channelUsername
- Ветку `sourceType === 'youtube'` — извлечение videoId
- Специальный случай rbc.ru — маппинг newsline

### Блок 4: RssRateLimiter (6 мин)
**Сцена:** Code (RssRateLimiter.ts)

Показать:
- `DEFAULT_CONFIGS` — разные лимиты по доменам
- `canMakeRequest()` — три проверки
- `recordError()` — exponential backoff
- Redis + memory cache двухуровневость

### Блок 5: AlertManager (6 мин)
**Сцена:** Code (AlertManager.ts) → Slides

Показать:
- `initializeDefaultRules()` — 17 правил
- `checkAlertConditions()` — setInterval(30s)
- `collectSystemMetrics()` — dynamic import
- `triggerAlert()` → `sendNotifications()`
- Cooldown механизм

### Блок 6: Производительность (3 мин)
**Сцена:** Slides → Terminal (логи)

Показать:
- Prometheus метрики в коде
- Реальные логи цикла сбора
- Кластерную координацию через Redis

---

## 📊 Данные для демонстрации

### Подготовить в БД
- Минимум 500 статей из разных источников
- Статистика сбора за последние 24 часа
- Несколько записей с ошибками в collection_stats

### Подготовить в логах
```bash
# Запустить сбор вручную и показать логи
curl -X POST http://localhost:5000/api/admin/jobs/collect \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"group": "fast"}'
```

### Метрики для слайдов
- Реальное время цикла из логов
- Количество источников по группам
- Error rate за последние 24 часа

---

## 🎯 Ключевые моменты для акцента

1. **Последовательность** — не параллельность, объяснить почему
2. **Функция parseSourceFeed** — не класс, чистота и тестируемость
3. **Один парсер для трёх типов** — RSS, Telegram, YouTube
4. **AlertManager независим** — не вызывается из CollectNewsUseCase
5. **Redis + memory** — двухуровневый rate limiter

---

## 🔧 Технические требования

### Настройки OBS
```
Сцены:
1. "Intro" — камера + заставка
2. "Slides" — презентация
3. "Code" — VS Code + камера (PiP)
4. "Terminal" — терминал + камера (PiP)
5. "Outro" — камера + подписка
```

### Разрешение и качество
- **Видео:** 1920x1080 60fps
- **Битрейт:** 8000 kbps
- **Аудио:** 48kHz 320kbps

---

*Подготовка обеспечит точное соответствие демонстрации реальному коду проекта.*
