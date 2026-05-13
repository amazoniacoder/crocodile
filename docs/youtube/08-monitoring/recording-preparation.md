# Подготовка к записи Эпизода 8: "Мониторинг и алерты"

---

## 📋 Файлы для демонстрации

```
server/infrastructure/monitoring/
├── PrometheusMetrics.ts              ← Блок 1: Counter, Histogram, Gauge
├── HealthMonitoringService.ts        ← Блок 2: Promise.allSettled, три статуса
├── SlaMonitor.ts                     ← Блок 3: percentiles, пороги, нарушения
└── MonitoringIntegrationService.ts   ← Блок 4: EventBus, graceful shutdown

client/src/components/admin/monitor/
├── MonitorLayout.tsx                 ← Блок 4: 15 зон, sidebar, tooltip
├── ZoneA/ZoneA.tsx                   ← Блок 4: двойной polling, WebSocket
├── ZoneA/OverviewStats.tsx           ← Блок 4: статистика обзора
├── ZoneB/ZoneB.tsx                   ← Блок 4: системные метрики
└── ZoneB/SystemMetrics.tsx           ← Блок 4: RunningTimer, ProgressBar
```

### Порядок открытия в VS Code
1. `PrometheusMetrics.ts` — показать три типа + collectDefaultMetrics
2. `HealthMonitoringService.ts` — показать Promise.allSettled + calculateOverallHealth
3. `SlaMonitor.ts` — показать middleware() + calculatePercentile + DEFAULT_THRESHOLDS
4. `MonitoringIntegrationService.ts` — показать EventBus + graceful shutdown
5. `MonitorLayout.tsx` — показать ZONES массив + createPortal tooltip + RAF throttle
6. `ZoneA/ZoneA.tsx` — показать двойной polling + WebSocket subscribe
7. `ZoneB/SystemMetrics.tsx` — показать RunningTimer + ProgressBar

---

## 🎬 Подготовить перед записью

### Браузер
- [ ] Открыть `/admin/monitor` — убедиться что кабинет загружается
- [ ] Zone A → убедиться что данные отображаются
- [ ] Zone B → убедиться что SystemMetrics показывает данные
- [ ] DevTools → Network → включить запись

### Терминал
- [ ] Приложение запущено: `npm run dev`
- [ ] `export ADMIN_TOKEN=<токен>`
- [ ] Проверить `/metrics`: `curl -s http://localhost:5000/metrics | head -20`
- [ ] Проверить `/api/health`: `curl -s http://localhost:5000/api/health | jq .`

### VS Code
- [ ] Открыть все 7 файлов в отдельных вкладках
- [ ] Шрифт 16px, minimap отключён, word wrap включён

---

## 🎯 Ключевые акценты

1. **collectDefaultMetrics** — одна строка = 30+ метрик Node.js бесплатно
2. **Promise.allSettled vs Promise.all** — одна упавшая проверка не скрывает остальные
3. **setImmediate в SLA middleware** — запись метрики не блокирует HTTP ответ
4. **Двойной polling** — разные данные требуют разных интервалов (30с vs 2с)
5. **createPortal для tooltip** — избегаем overflow: hidden проблем
6. **RAF throttle** — плавный UI без лишних ре-рендеров при движении мыши
7. **p95 честнее среднего** — среднее скрывает "хвост" медленных запросов

---

## 🎬 Сценарии демонстрации

### Prometheus метрики
```bash
curl -s http://localhost:5000/metrics | grep "^# HELP" | head -15
# → показать список всех метрик

curl -s http://localhost:5000/metrics | grep "http_requests_total"
# → показать counter с labels
```

### Health check
```bash
curl -s http://localhost:5000/api/health | jq .
# → показать overall + components
```

### Кабинет — Zone A
```
1. Sidebar hover → tooltip появляется
2. Sidebar expand (300ms delay)
3. Zone A → вкладки
4. DevTools Network → два интервала polling
5. Запустить коллектор → Zone B RunningTimer тикает
```

### SLA метрики
```bash
# Сгенерировать нагрузку
for i in {1..20}; do curl -s http://localhost:5000/api/news > /dev/null; done

# Посмотреть p50/p95/p99
curl -s http://localhost:5000/api/admin/sla/metrics \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.[0] | {p50, p95, p99}'
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
- [ ] `/metrics` endpoint возвращает данные
- [ ] Кабинет `/admin/monitor` загружается
- [ ] ADMIN_TOKEN экспортирован
- [ ] Все 7 файлов открыты в VS Code
- [ ] DevTools открыт на вкладке Network
- [ ] Микрофон проверен
- [ ] Уведомления системы отключены

---

*Подготовка обеспечит точное соответствие демонстрации реальному коду.*
