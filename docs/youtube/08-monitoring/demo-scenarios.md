# Сценарии демонстрации для Эпизода 8: "Мониторинг и алерты"

---

## 🎬 Демо 1: Prometheus метрики — /metrics endpoint

### Подготовка
- [ ] Приложение запущено: `npm run dev`

### Сценарий
```bash
# Получить все метрики в Prometheus формате
curl -s http://localhost:5000/metrics | head -80

# Ожидаемый вывод (фрагмент):
# # HELP nodejs_heap_size_used_bytes Process heap size used from Node.js
# # TYPE nodejs_heap_size_used_bytes gauge
# nodejs_heap_size_used_bytes 45678592
#
# # HELP http_requests_total Total number of HTTP requests
# # TYPE http_requests_total counter
# http_requests_total{method="GET",path="/api/news",status="200"} 1247
# http_requests_total{method="GET",path="/api/health",status="200"} 89
#
# # HELP rss_articles_collected_total Total number of articles collected
# # TYPE rss_articles_collected_total counter
# rss_articles_collected_total{source="lenta",region="russia",category="main"} 342
#
# # HELP http_request_duration_seconds HTTP request duration in seconds
# # TYPE http_request_duration_seconds histogram
# http_request_duration_seconds_bucket{method="GET",path="/api/news",le="0.1"} 1180
# http_request_duration_seconds_bucket{method="GET",path="/api/news",le="0.5"} 1240
# http_request_duration_seconds_bucket{method="GET",path="/api/news",le="+Inf"} 1247

# Фильтровать только RSS метрики
curl -s http://localhost:5000/metrics | grep "rss_"

# Фильтровать только cache метрики
curl -s http://localhost:5000/metrics | grep "cache_"
```

---

## 🎬 Демо 2: Health Check — /api/health

### Сценарий
```bash
# Полный health check
curl -s http://localhost:5000/api/health | jq .

# Ожидаемый ответ:
# {
#   "overall": "healthy",
#   "components": {
#     "database":    { "status": "healthy",     "responseTime": 8 },
#     "redis":       { "status": "healthy",     "responseTime": 2 },
#     "ner":         { "status": "unavailable", "error": "..." },
#     "gracefulNer": { "status": "degraded",    "details": { "fallbackStrategy": "simple" } }
#   },
#   "timestamp": "2025-05-15T10:30:00.000Z",
#   "uptime": 86400000
# }

# Только overall статус
curl -s http://localhost:5000/api/health | jq .overall

# Только компоненты с ошибками
curl -s http://localhost:5000/api/health | jq '.components | to_entries | map(select(.value.status != "healthy"))'
```

---

## 🎬 Демо 3: Кабинет мониторинга — Zone A

### Подготовка
- [ ] Открыть `/admin/monitor` в браузере
- [ ] Войти с ADMIN_TOKEN

### Сценарий
1. Показать sidebar — 15 зон, иконки
2. Навести на зону → показать tooltip (createPortal)
3. Раскрытие sidebar при hover (300ms delay)
4. Zone A → показать вкладки: Обзор / Россия / Мир / Ошибки / Заблокированы
5. Вкладка "Обзор" → OverviewStats: статьи за 1ч, статус коллектора
6. RegionPieChart + ActivityChart
7. DevTools → Network → показать два интервала polling:
   - `/api/admin/stats` каждые 30 сек
   - `/api/admin/system` каждые 2 сек
8. Вкладка "Ошибки" → SourceHealthTable с ошибками

---

## 🎬 Демо 4: Zone B — системные метрики

### Сценарий
1. Перейти в Zone B
2. Показать SystemMetrics карточку:
   - RSS память (ProgressBar — зелёный/жёлтый/красный)
   - CPU loadAvg 1/5/15 минут
   - Uptime сервера и ОС
3. Если коллектор запущен → показать RunningTimer (тикает)
4. Показать CollectionTimingChart — история длительности циклов
5. Web Push stats — подписки, VAPID статус

### Симуляция запуска коллектора
```bash
# Запустить сбор вручную
curl -X POST http://localhost:5000/api/admin/jobs/collect \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Сразу перейти в Zone B → RunningTimer начнёт тикать
# Zone A → статус "▶ выполняется... 12 с"
```

---

## 🎬 Демо 5: SLA метрики

### Сценарий
```bash
# Получить SLA метрики для всех endpoint'ов
curl -s http://localhost:5000/api/admin/sla/metrics \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Ожидаемый ответ:
# [
#   {
#     "endpoint": "/api/news",
#     "method": "GET",
#     "totalRequests": 1247,
#     "averageResponseTime": 89,
#     "p50": 45,
#     "p95": 180,
#     "p99": 420,
#     "errorRate": 0.08,
#     "availability": 99.92,
#     "throughput": 2.1
#   }
# ]

# SLA summary
curl -s http://localhost:5000/api/admin/sla/summary \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Нарушения SLA
curl -s http://localhost:5000/api/admin/sla/violations \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

---

## 🎬 Демо 6: MonitoringIntegrationService — диагностика

### Сценарий
```bash
# Полная диагностика системы
curl -s http://localhost:5000/api/admin/monitoring/diagnostics \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Ожидаемый ответ:
# {
#   "overall": "healthy",
#   "components": {
#     "monitoring": "healthy",
#     "alerting": "healthy",
#     "caching": "healthy"
#   },
#   "recommendations": []
# }

# Статус всех систем мониторинга
curl -s http://localhost:5000/api/admin/monitoring/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

---

## ⚙️ Команды для подготовки

```bash
# Проверить что /metrics endpoint работает
curl -s http://localhost:5000/metrics | grep "^# HELP" | wc -l
# Ожидаем: 30+ метрик

# Проверить что health check отвечает
curl -s http://localhost:5000/api/health | jq .overall

# Сгенерировать нагрузку для SLA метрик
for i in {1..20}; do
  curl -s http://localhost:5000/api/news > /dev/null
done

# Проверить SLA метрики после нагрузки
curl -s http://localhost:5000/api/admin/sla/metrics \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.[0] | {p50, p95, p99}'
```
