# Часть 9: Практические примеры для NewsAggregator

> Готовые запросы для мониторинга новостного агрегатора

---

## HTTP API Мониторинг

### 1. Запросов в секунду (общая нагрузка)

```promql
rate(http_requests_total[5m])
```

**Что показывает:**
Сколько HTTP-запросов обрабатывается в секунду.

**Когда использовать:**
- Проверить текущую нагрузку
- Найти пиковые часы
- Сравнить с обычной нагрузкой

**Нормальные значения:**
- 0.5-2 req/sec — низкая нагрузка
- 2-10 req/sec — средняя нагрузка
- >10 req/sec — высокая нагрузка

### 2. Запросов в секунду по эндпоинтам

```promql
sum by (path) (rate(http_requests_total[5m]))
```

**Что показывает:**
Какие эндпоинты самые популярные.

**Пример результата:**
```
{path="/api/news"}    5.2 req/sec
{path="/api/health"}  0.5 req/sec
{path="/"}            2.1 req/sec
```

### 3. Топ-5 самых популярных эндпоинтов

```promql
topk(5, sum by (path) (rate(http_requests_total[5m])))
```

### 4. Процент ошибок 5xx

```promql
rate(http_requests_total{status=~"5.."}[5m]) 
/ 
rate(http_requests_total[5m]) * 100
```

**Что показывает:**
Сколько процентов запросов возвращают ошибки сервера.

**Нормальные значения:**
- 0% — идеально
- <1% — приемлемо
- >5% — проблема (сработает алерт)

### 5. Количество ошибок 5xx за последний час

```promql
increase(http_requests_total{status=~"5.."}[1h])
```

### 6. Среднее время ответа (p50)

```promql
histogram_quantile(0.5, rate(http_request_duration_seconds_bucket[5m]))
```

**Что показывает:**
50% запросов обрабатываются быстрее этого значения.

**Нормальные значения:**
- <0.1s — отлично
- 0.1-0.5s — хорошо
- >1s — медленно

### 7. 95-й перцентиль времени ответа (p95)

```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**Что показывает:**
95% запросов обрабатываются быстрее этого значения.

**Нормальные значения:**
- <0.5s — отлично
- 0.5-2s — приемлемо
- >2s — медленно (сработает алерт)

### 8. 99-й перцентиль времени ответа (p99)

```promql
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

**Что показывает:**
Даже самые медленные 1% запросов обрабатываются быстрее этого значения.

### 9. Самые медленные эндпоинты

```promql
topk(5, histogram_quantile(0.95, sum by (path) (rate(http_request_duration_seconds_bucket[5m]))))
```

---

## RSS Collection Мониторинг

### 10. Статей собрано за последний час

```promql
sum(increase(rss_articles_collected_total[1h]))
```

**Что показывает:**
Общее количество новых статей за час.

**Нормальные значения:**
- 50-200 статей/час — нормально
- <50 статей/час — мало (может сработать алерт)
- >500 статей/час — много (возможно, дубликаты)

### 11. Статей в секунду (скорость сбора)

```promql
sum(rate(rss_articles_collected_total[5m]))
```

### 12. Топ-5 источников по количеству статей

```promql
topk(5, sum by (source) (increase(rss_articles_collected_total[1h])))
```

**Пример результата:**
```
{source="Lenta.ru"}           42 статьи
{source="RBC"}                38 статей
{source="Habr — Новости"}     25 статей
{source="Guardian — World"}   18 статей
{source="ТАСС"}               15 статей
```

### 13. Статей по регионам

```promql
sum by (region) (increase(rss_articles_collected_total[1h]))
```

**Пример результата:**
```
{region="russia"}  120 статей
{region="world"}   80 статей
```

### 14. Статей по категориям

```promql
sum by (category) (increase(rss_articles_collected_total[1h]))
```

**Пример результата:**
```
{category="tech"}      50 статей
{category="economy"}   40 статей
{category="politics"}  35 статей
{category="society"}   30 статей
{category="other"}     45 статей
```

### 15. Источники без новых статей за последний час

```promql
sum by (source) (increase(rss_articles_collected_total[1h])) == 0
```

**Что показывает:**
Какие источники не принесли новых статей.

**Когда использовать:**
- Проверить, работают ли источники
- Найти "мёртвые" источники

### 16. Длительность последнего цикла сбора

```promql
rss_collection_duration_seconds
```

**Нормальные значения:**
- <60s — быстро
- 60-120s — нормально
- >300s — медленно

### 17. Минут с последнего успешного сбора

```promql
(time() - rss_collection_last_success_timestamp_seconds) / 60
```

**Что показывает:**
Сколько минут назад был последний успешный сбор.

**Нормальные значения:**
- <5 минут — всё работает
- >30 минут — проблема (сработает алерт)

### 18. Ошибок сбора за последний час

```promql
sum(increase(rss_collection_errors_total[1h]))
```

### 19. Источники с ошибками

```promql
sum by (source) (increase(rss_collection_errors_total[1h])) > 0
```

### 20. Типы ошибок сбора

```promql
sum by (error_type) (increase(rss_collection_errors_total[1h]))
```

**Пример результата:**
```
{error_type="network"}      5 ошибок
{error_type="parse"}        2 ошибки
{error_type="rate_limited"} 1 ошибка
```

---

## Системные метрики

### 21. Использование памяти (MB)

```promql
nodejs_heap_size_used_bytes / 1024 / 1024
```

**Нормальные значения:**
- <200 MB — низкое
- 200-500 MB — нормальное
- >500 MB — высокое (может сработать алерт)
- >800 MB — критическое (сработает алерт)

### 22. Процент использования памяти

```promql
nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes * 100
```

### 23. Тренд использования памяти (растёт или падает)

```promql
delta(nodejs_heap_size_used_bytes[1h]) / 1024 / 1024
```

**Что показывает:**
На сколько MB изменилась память за последний час.

**Интерпретация:**
- Положительное значение — память растёт
- Отрицательное значение — память падает
- Постоянный рост — возможна утечка памяти

### 24. Прогноз использования памяти через час

```promql
predict_linear(nodejs_heap_size_used_bytes[1h], 3600) / 1024 / 1024
```

**Что показывает:**
Сколько памяти будет использоваться через час, если тренд сохранится.

### 25. CPU usage (процент)

```promql
rate(nodejs_process_cpu_user_seconds_total[5m]) * 100
```

**Нормальные значения:**
- <10% — низкая нагрузка
- 10-50% — средняя нагрузка
- >80% — высокая нагрузка

### 26. Event loop lag (миллисекунды)

```promql
nodejs_nodejs_eventloop_lag_seconds * 1000
```

**Что показывает:**
Задержка обработки событий в Node.js.

**Нормальные значения:**
- <10 ms — отлично
- 10-50 ms — нормально
- >100 ms — проблема (приложение тормозит)

### 27. Garbage Collection (частота)

```promql
rate(nodejs_nodejs_gc_duration_seconds_count[5m])
```

**Что показывает:**
Сколько раз в секунду срабатывает сборка мусора.

**Нормальные значения:**
- <1 GC/sec — нормально
- >5 GC/sec — слишком часто (проблема с памятью)

### 28. Время GC (миллисекунды)

```promql
rate(nodejs_nodejs_gc_duration_seconds_sum[5m]) * 1000
```

**Что показывает:**
Сколько миллисекунд в секунду тратится на GC.

---

## Кэш метрики

### 29. Cache hit rate (процент)

```promql
rate(cache_hits_total[5m]) 
/ 
(rate(cache_hits_total[5m]) + rate(cache_misses_total[5m])) * 100
```

**Что показывает:**
Процент запросов, которые нашли данные в кэше.

**Нормальные значения:**
- >80% — отлично
- 50-80% — нормально
- <50% — плохо (кэш неэффективен)

### 30. Cache miss rate (процент)

```promql
rate(cache_misses_total[5m]) 
/ 
(rate(cache_hits_total[5m]) + rate(cache_misses_total[5m])) * 100
```

### 31. Размер кэша (MB)

```promql
cache_size_bytes / 1024 / 1024
```

### 32. Попаданий в кэш за час

```promql
increase(cache_hits_total[1h])
```

### 33. Промахов кэша за час

```promql
increase(cache_misses_total[1h])
```

---

## Кластеризация

### 34. Кластеров создано за час

```promql
sum(increase(news_clusters_created_total[1h]))
```

### 35. Кластеров по регионам

```promql
sum by (region) (increase(news_clusters_created_total[1h]))
```

### 36. Кластеров по категориям

```promql
sum by (category) (increase(news_clusters_created_total[1h]))
```

---

## Алерты

### 37. Алертов сработало за последний час

```promql
increase(alerts_triggered_total[1h])
```

### 38. Алертов по severity

```promql
sum by (severity) (increase(alerts_triggered_total[1h]))
```

**Пример результата:**
```
{severity="warning"}   5 алертов
{severity="critical"}  2 алерта
```

### 39. Самые частые алерты

```promql
topk(5, sum by (rule_id) (increase(alerts_triggered_total[24h])))
```

---

## Сравнение с прошлым

### 40. Запросов сейчас vs час назад

```promql
rate(http_requests_total[5m]) 
- 
rate(http_requests_total[5m] offset 1h)
```

**Что показывает:**
На сколько изменилась нагрузка по сравнению с часом назад.

**Интерпретация:**
- Положительное — нагрузка выросла
- Отрицательное — нагрузка упала

### 41. Статей сейчас vs вчера

```promql
sum(increase(rss_articles_collected_total[1h])) 
- 
sum(increase(rss_articles_collected_total[1h] offset 24h))
```

### 42. Память сейчас vs час назад (MB)

```promql
(nodejs_heap_size_used_bytes - nodejs_heap_size_used_bytes offset 1h) / 1024 / 1024
```

---

## Комплексные запросы

### 43. Здоровье системы (0-100)

```promql
(
  (count(up == 1) / count(up)) * 30 +
  (1 - rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])) * 30 +
  (rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))) * 20 +
  (1 - nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes) * 20
) * 100
```

**Что показывает:**
Общий "индекс здоровья" системы от 0 до 100.

**Компоненты:**
- 30% — targets работают
- 30% — нет ошибок 5xx
- 20% — высокий cache hit rate
- 20% — память не переполнена

### 44. Эффективность источника (статей на ошибку)

```promql
sum by (source) (increase(rss_articles_collected_total[1h])) 
/ 
(sum by (source) (increase(rss_collection_errors_total[1h])) + 1)
```

**Что показывает:**
Сколько статей приносит источник на одну ошибку.

**Интерпретация:**
- Высокое значение — источник надёжный
- Низкое значение — источник проблемный

### 45. Производительность API (запросов на миллисекунду)

```promql
rate(http_requests_total[5m]) 
/ 
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) 
/ 1000
```

---

## Как использовать эти запросы

### 1. Создай файл с запросами

Сохрани полезные запросы в файл:
```
D:\BlogPro\docs\prometheus\my-queries.txt
```

### 2. Создай дашборд в браузере

Открой несколько вкладок Graph с разными запросами:
- Вкладка 1: Запросов в секунду
- Вкладка 2: Использование памяти
- Вкладка 3: Статей за час
- Вкладка 4: Cache hit rate

### 3. Используй автообновление

Для мониторинга в реальном времени:
- Выбери период: **1h**
- Включи автообновление: **⟳ 15s**

### 4. Экспортируй данные

Для отчётов:
1. Построй график
2. Переключись на вкладку **Table**
3. Скопируй данные в Excel

---

## Что дальше?

Теперь у тебя есть:
- ✅ 45 готовых запросов для NewsAggregator
- ✅ Понимание нормальных значений метрик
- ✅ Способы сравнения с прошлым
- ✅ Комплексные запросы для анализа

**Следующий шаг:** [Часть 13: Ежедневные задачи мониторинга](./13-daily-tasks.md) →

Там ты узнаешь, как использовать эти запросы в повседневной работе.
