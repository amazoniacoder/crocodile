# Часть 13: Ежедневные задачи мониторинга

> Практический чеклист для работы с Prometheus

---

## Утренняя проверка (5 минут)

### 1. Проверь, что Prometheus работает

**Открой:** http://localhost:9090

Если страница не открывается:
```cmd
# Запусти батник
D:\Prometheus\start-prometheus.bat
```

### 2. Проверь статус targets

**Открой:** http://localhost:9090/targets

**Что проверить:**
- ✅ `news-aggregator` — **UP** 🟢
- ✅ `prometheus` — **UP** 🟢

Если target **DOWN** 🔴:
1. Проверь, что NewsAggregator работает
2. Открой http://localhost:5000/metrics в браузере
3. Если не открывается — запусти NewsAggregator

### 3. Проверь активные алерты

**Открой:** http://localhost:9090/alerts

**Что проверить:**
- Сколько алертов в состоянии **Firing** 🔴
- Какие алерты в состоянии **Pending** 🟡

**Если есть Firing алерты:**
1. Прочитай описание (Summary)
2. Скопируй Expression
3. Построй график в Graph
4. Найди причину и исправь

### 4. Проверь ключевые метрики

**Открой:** http://localhost:9090/graph

**Запрос 1: Использование памяти**
```promql
nodejs_heap_size_used_bytes / 1024 / 1024
```

**Норма:** <500 MB

**Запрос 2: Статей за последний час**
```promql
sum(increase(rss_articles_collected_total[1h]))
```

**Норма:** 50-200 статей

**Запрос 3: Процент ошибок**
```promql
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100
```

**Норма:** <1%

---

## Еженедельная проверка (15 минут)

### 1. Анализ трендов

**Открой:** http://localhost:9090/graph

**Период:** Последние 7 дней

**Запрос 1: Тренд использования памяти**
```promql
nodejs_heap_size_used_bytes / 1024 / 1024
```

**Что проверить:**
- Память растёт постоянно? → Возможна утечка
- Память стабильна? → Всё в порядке
- Память падает после перезапуска? → Нормально

**Запрос 2: Тренд сбора статей**
```promql
sum(increase(rss_articles_collected_total[1h]))
```

**Что проверить:**
- Есть ли дни с аномально низким сбором?
- Есть ли источники, которые перестали работать?

**Запрос 3: Тренд нагрузки**
```promql
rate(http_requests_total[5m])
```

**Что проверить:**
- Растёт ли нагрузка?
- Есть ли пиковые часы?

### 2. Проверка источников

**Запрос: Источники без статей за неделю**
```promql
sum by (source) (increase(rss_articles_collected_total[7d])) == 0
```

**Что делать:**
- Проверь, работает ли источник
- Открой RSS-ленту в браузере
- Если источник мёртв — отключи его в админке

### 3. Проверка производительности

**Запрос: p95 время ответа за неделю**
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[7d]))
```

**Что проверить:**
- Есть ли дни с аномально медленными запросами?
- Коррелирует ли это с высокой нагрузкой или памятью?

### 4. Проверка алертов

**Запрос: Алертов за неделю**
```promql
sum by (rule_id) (increase(alerts_triggered_total[7d]))
```

**Что проверить:**
- Какие алерты срабатывают чаще всего?
- Нужно ли скорректировать пороги?

---

## Расследование проблемы

### Сценарий 1: Медленная лента

**Жалоба:** "Лента долго загружается"

**Шаг 1: Проверь время ответа API**
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{path="/api/news"}[5m]))
```

**Если >1s:**

**Шаг 2: Проверь память**
```promql
nodejs_heap_size_used_bytes / 1024 / 1024
```

**Если >500 MB:**
- Возможна утечка памяти
- Перезапусти NewsAggregator
- Мониторь память дальше

**Шаг 3: Проверь нагрузку**
```promql
rate(http_requests_total[5m])
```

**Если >10 req/sec:**
- Высокая нагрузка
- Проверь, нет ли DDoS
- Проверь логи на подозрительные IP

**Шаг 4: Проверь БД**
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{path="/api/news"}[5m]))
```

Сравни с:
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{path="/api/health"}[5m]))
```

Если `/api/news` медленнее — проблема в БД-запросе.

### Сценарий 2: Мало статей собирается

**Жалоба:** "Новостей стало меньше"

**Шаг 1: Проверь общий сбор**
```promql
sum(increase(rss_articles_collected_total[1h]))
```

**Если <50 статей:**

**Шаг 2: Проверь, какие источники работают**
```promql
sum by (source) (increase(rss_articles_collected_total[1h]))
```

**Шаг 3: Проверь ошибки сбора**
```promql
sum by (source) (increase(rss_collection_errors_total[1h])) > 0
```

**Шаг 4: Проверь, когда был последний сбор**
```promql
(time() - rss_collection_last_success_timestamp_seconds) / 60
```

**Если >30 минут:**
- RSS сбор завис
- Проверь логи NewsAggregator
- Перезапусти NewsAggregator

### Сценарий 3: Высокое использование памяти

**Алерт:** "HighMemoryUsage"

**Шаг 1: Проверь текущую память**
```promql
nodejs_heap_size_used_bytes / 1024 / 1024
```

**Шаг 2: Проверь тренд за последний час**
```promql
delta(nodejs_heap_size_used_bytes[1h]) / 1024 / 1024
```

**Если постоянно растёт:**
- Возможна утечка памяти
- Проверь, нет ли зацикленных запросов
- Проверь логи на ошибки

**Шаг 3: Проверь GC**
```promql
rate(nodejs_nodejs_gc_duration_seconds_count[5m])
```

**Если >5 GC/sec:**
- Слишком частая сборка мусора
- Память переполнена
- Нужно перезапустить или увеличить heap

**Шаг 4: Перезапусти NewsAggregator**
```bash
# Останови
Ctrl+C в окне NewsAggregator

# Запусти снова
npm run dev
```

**Шаг 5: Мониторь память после перезапуска**
```promql
nodejs_heap_size_used_bytes / 1024 / 1024
```

Если память снова растёт — ищи утечку в коде.

### Сценарий 4: Ошибки 5xx

**Алерт:** "HighErrorRate"

**Шаг 1: Проверь количество ошибок**
```promql
increase(http_requests_total{status=~"5.."}[1h])
```

**Шаг 2: Проверь, какие эндпоинты**
```promql
sum by (path) (increase(http_requests_total{status=~"5.."}[1h]))
```

**Шаг 3: Проверь логи**
```bash
# Открой логи NewsAggregator
tail -f D:\BlogPro\logs\combined.log
```

Ищи строки с `ERROR` или `500`.

**Шаг 4: Проверь БД**
```bash
# Проверь подключение к БД
curl http://localhost:5000/api/health
```

Если `database.status` не `healthy` — проблема с БД.

---

## Оптимизация на основе метрик

### 1. Оптимизация кэша

**Проверь cache hit rate:**
```promql
rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m])) * 100
```

**Если <50%:**
- Кэш неэффективен
- Увеличь TTL кэша
- Проверь, что кэшируется

**Если >90%:**
- Кэш работает отлично
- Можно уменьшить TTL для более свежих данных

### 2. Оптимизация источников

**Найди самые медленные источники:**
```promql
topk(5, sum by (source) (rss_collection_duration_seconds))
```

**Что делать:**
- Увеличь timeout для медленных источников
- Проверь, не блокирует ли источник запросы
- Рассмотри отключение очень медленных источников

**Найди источники с ошибками:**
```promql
topk(5, sum by (source) (increase(rss_collection_errors_total[24h])))
```

**Что делать:**
- Проверь, работает ли источник
- Проверь, не изменился ли формат RSS
- Отключи источник, если он мёртв

### 3. Оптимизация API

**Найди самые медленные эндпоинты:**
```promql
topk(5, histogram_quantile(0.95, sum by (path) (rate(http_request_duration_seconds_bucket[5m]))))
```

**Что делать:**
- Добавь индексы в БД
- Увеличь кэширование
- Оптимизируй SQL-запросы

---

## Экспорт данных для отчётов

### 1. Через веб-интерфейс

**Шаг 1:** Построй график в Graph

**Шаг 2:** Переключись на вкладку **Table**

**Шаг 3:** Скопируй данные (Ctrl+A, Ctrl+C)

**Шаг 4:** Вставь в Excel

### 2. Через HTTP API

**Текущее значение:**
```bash
curl "http://localhost:9090/api/v1/query?query=nodejs_heap_size_used_bytes"
```

**Диапазон значений:**
```bash
curl "http://localhost:9090/api/v1/query_range?query=nodejs_heap_size_used_bytes&start=2025-05-06T00:00:00Z&end=2025-05-06T23:59:59Z&step=15s"
```

**Результат:** JSON с данными

### 3. Создание отчёта

**Пример отчёта за неделю:**

1. **Статистика сбора:**
   - Всего статей: `sum(increase(rss_articles_collected_total[7d]))`
   - Среднее в день: `sum(increase(rss_articles_collected_total[7d])) / 7`
   - Топ-5 источников: `topk(5, sum by (source) (increase(rss_articles_collected_total[7d])))`

2. **Производительность:**
   - Среднее время ответа: `avg_over_time(histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[7d]))[7d:1h])`
   - Процент ошибок: `avg_over_time((rate(http_requests_total{status=~"5.."}[7d]) / rate(http_requests_total[7d]))[7d:1h]) * 100`

3. **Ресурсы:**
   - Средняя память: `avg_over_time(nodejs_heap_size_used_bytes[7d]) / 1024 / 1024`
   - Максимальная память: `max_over_time(nodejs_heap_size_used_bytes[7d]) / 1024 / 1024`

---

## Чеклист перед отпуском

Если уезжаешь на несколько дней:

### 1. Настрой автозапуск

**Prometheus как сервис:**
```cmd
nssm install Prometheus "D:\Prometheus\prometheus.exe"
nssm start Prometheus
```

**NewsAggregator как сервис:**
```cmd
nssm install NewsAggregator "D:\BlogPro\node_modules\.bin\tsx" "D:\BlogPro\server\index.ts"
nssm start NewsAggregator
```

### 2. Проверь алерты

Убедись, что все критические алерты настроены:
- ✅ PrometheusDown
- ✅ RSSCollectionStalled
- ✅ CriticalMemoryUsage

### 3. Проверь retention

Убедись, что данные хранятся достаточно долго:
```bash
--storage.tsdb.retention.time=15d
```

### 4. Проверь место на диске

```bash
dir D:\Prometheus\data
```

Убедись, что есть минимум 5 GB свободного места.

### 5. Запиши контакты

На случай проблем:
- URL Prometheus: http://localhost:9090
- URL NewsAggregator: http://localhost:5000
- Логи: `D:\BlogPro\logs\combined.log`

---

## Что дальше?

Теперь ты знаешь:
- ✅ Как проводить ежедневную проверку
- ✅ Как расследовать типовые проблемы
- ✅ Как оптимизировать на основе метрик
- ✅ Как экспортировать данные для отчётов
- ✅ Как подготовиться к отпуску

**Следующий шаг:** [Часть 14: Решение типовых проблем](./14-troubleshooting.md) →

Там ты найдёшь решения для всех возможных проблем с Prometheus.
