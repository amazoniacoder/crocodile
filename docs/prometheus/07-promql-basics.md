# Часть 7: Основы PromQL

> Язык запросов Prometheus простыми словами

---

## Что такое PromQL?

**PromQL** (Prometheus Query Language) — это язык для получения данных из Prometheus.

Аналогия:
- **SQL** — для баз данных (SELECT * FROM users)
- **PromQL** — для метрик (rate(http_requests_total[5m]))

---

## Базовый синтаксис

### 1. Простой запрос метрики

**Запрос:**
```promql
nodejs_heap_size_used_bytes
```

**Что возвращает:**
Текущее значение метрики для всех комбинаций меток.

**Результат:**
```
nodejs_heap_size_used_bytes{instance="localhost:5000", job="news-aggregator"} 130000000
```

### 2. Фильтрация по меткам

**Запрос:**
```promql
http_requests_total{method="GET"}
```

**Что возвращает:**
Только запросы с методом GET.

**Результат:**
```
http_requests_total{method="GET", path="/api/news", status="200"} 1523
http_requests_total{method="GET", path="/api/health", status="200"} 42
```

### 3. Несколько условий

**Запрос:**
```promql
http_requests_total{method="GET", status="200"}
```

**Что возвращает:**
Только успешные GET-запросы.

### 4. Регулярные выражения

**Запрос:**
```promql
http_requests_total{status=~"5.."}
```

**Что возвращает:**
Все запросы с кодом 5xx (500, 502, 503, и т.д.).

**Операторы:**
- `=~` — соответствует регулярному выражению
- `!~` — НЕ соответствует регулярному выражению

**Примеры:**
```promql
# Все статусы, кроме 200
http_requests_total{status!="200"}

# Все пути, начинающиеся с /api/
http_requests_total{path=~"/api/.*"}

# Все источники, содержащие "Lenta"
rss_articles_collected_total{source=~".*Lenta.*"}
```

---

## Типы данных

### Instant Vector (Мгновенный вектор)

**Что:** Набор значений в **один момент времени**.

**Пример:**
```promql
nodejs_heap_size_used_bytes
```

**Результат:**
```
nodejs_heap_size_used_bytes{instance="localhost:5000"} 130000000 @1778044200
```

Одно значение для каждой комбинации меток.

### Range Vector (Диапазонный вектор)

**Что:** Набор значений за **период времени**.

**Пример:**
```promql
nodejs_heap_size_used_bytes[5m]
```

**Результат:**
```
nodejs_heap_size_used_bytes{instance="localhost:5000"}
  130000000 @1778044200
  132000000 @1778044215
  128000000 @1778044230
  ...
```

Все значения за последние 5 минут.

**Синтаксис периода:**
- `s` — секунды (5s)
- `m` — минуты (5m)
- `h` — часы (2h)
- `d` — дни (7d)
- `w` — недели (2w)
- `y` — годы (1y)

### Scalar (Скаляр)

**Что:** Одно число без меток.

**Пример:**
```promql
42
```

Используется редко, обычно в вычислениях.

---

## Арифметические операции

### Сложение, вычитание, умножение, деление

**Примеры:**
```promql
# Память в мегабайтах
nodejs_heap_size_used_bytes / 1024 / 1024

# Процент использования памяти
nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes * 100

# Разница между двумя метриками
cache_hits_total - cache_misses_total
```

### Операции между метриками

**Пример:**
```promql
# Процент ошибок
rate(http_requests_total{status=~"5.."}[5m]) 
/ 
rate(http_requests_total[5m]) * 100
```

**Что происходит:**
1. Вычисляется скорость ошибок 5xx
2. Вычисляется общая скорость запросов
3. Делится первое на второе
4. Умножается на 100 для процентов

---

## Функции для Range Vector

### rate() — Скорость изменения

**Что делает:**
Вычисляет скорость изменения счётчика **в секунду**.

**Пример:**
```promql
rate(http_requests_total[5m])
```

**Что возвращает:**
Сколько запросов в секунду за последние 5 минут.

**Когда использовать:**
- Для Counter метрик
- Когда нужна скорость (requests/sec, errors/sec)

### irate() — Мгновенная скорость

**Что делает:**
Вычисляет скорость между **последними двумя точками**.

**Пример:**
```promql
irate(http_requests_total[5m])
```

**Отличие от rate():**
- `rate()` — усреднённая скорость за период
- `irate()` — мгновенная скорость (более чувствительна к всплескам)

**Когда использовать:**
- Для графиков в реальном времени
- Когда важны кратковременные всплески

### increase() — Прирост

**Что делает:**
Вычисляет, на сколько **увеличился** счётчик за период.

**Пример:**
```promql
increase(http_requests_total[1h])
```

**Что возвращает:**
Сколько запросов было за последний час.

**Отличие от rate():**
- `rate()` — в секунду (2.5 req/sec)
- `increase()` — за весь период (9000 requests)

### delta() — Изменение Gauge

**Что делает:**
Вычисляет **разницу** между первым и последним значением.

**Пример:**
```promql
delta(nodejs_heap_size_used_bytes[1h])
```

**Что возвращает:**
На сколько изменилась память за последний час (может быть отрицательным).

**Когда использовать:**
- Для Gauge метрик
- Когда нужно понять тренд (растёт или падает)

---

## Агрегация

### sum() — Сумма

**Пример:**
```promql
sum(http_requests_total)
```

**Что возвращает:**
Общее количество запросов по всем меткам.

**С группировкой:**
```promql
sum by (method) (http_requests_total)
```

**Что возвращает:**
Сумма запросов для каждого метода отдельно:
```
{method="GET"}  1523
{method="POST"} 42
```

### avg() — Среднее

**Пример:**
```promql
avg(nodejs_heap_size_used_bytes)
```

**Что возвращает:**
Среднее использование памяти.

### max() / min() — Максимум / Минимум

**Пример:**
```promql
max(nodejs_heap_size_used_bytes)
```

**Что возвращает:**
Максимальное использование памяти.

### count() — Количество

**Пример:**
```promql
count(up == 1)
```

**Что возвращает:**
Сколько targets в состоянии UP.

---

## Сравнение и фильтрация

### Операторы сравнения

```promql
# Больше
nodejs_heap_size_used_bytes > 500000000

# Меньше
nodejs_heap_size_used_bytes < 100000000

# Равно
up == 1

# Не равно
up != 0
```

**Что возвращает:**
Только те временные ряды, где условие выполнено.

### bool модификатор

**Пример:**
```promql
nodejs_heap_size_used_bytes > bool 500000000
```

**Что возвращает:**
- `1` — если условие выполнено
- `0` — если не выполнено

**Зачем это нужно:**
Для использования в вычислениях.

---

## Практические примеры

### 1. Запросов в секунду

```promql
rate(http_requests_total[5m])
```

### 2. Процент ошибок

```promql
rate(http_requests_total{status=~"5.."}[5m]) 
/ 
rate(http_requests_total[5m]) * 100
```

### 3. Память в мегабайтах

```promql
nodejs_heap_size_used_bytes / 1024 / 1024
```

### 4. Статей за последний час

```promql
increase(rss_articles_collected_total[1h])
```

### 5. Топ-5 источников по количеству статей

```promql
topk(5, sum by (source) (rss_articles_collected_total))
```

### 6. Сколько targets работают

```promql
count(up == 1)
```

### 7. Время с последнего успешного сбора (минуты)

```promql
(time() - rss_collection_last_success_timestamp_seconds) / 60
```

### 8. Cache hit rate (процент)

```promql
rate(cache_hits_total[5m]) 
/ 
(rate(cache_hits_total[5m]) + rate(cache_misses_total[5m])) * 100
```

---

## Временные смещения

### offset — Сдвиг во времени

**Пример:**
```promql
nodejs_heap_size_used_bytes offset 1h
```

**Что возвращает:**
Значение памяти **час назад**.

**Зачем это нужно:**
Сравнить "сейчас" с "час назад".

**Пример сравнения:**
```promql
# Разница между сейчас и час назад
nodejs_heap_size_used_bytes - nodejs_heap_size_used_bytes offset 1h
```

---

## Специальные функции

### time() — Текущее время

**Пример:**
```promql
time()
```

**Что возвращает:**
Текущий Unix timestamp в секундах.

**Зачем это нужно:**
Вычислить, сколько времени прошло с события.

**Пример:**
```promql
# Минут с последнего сбора
(time() - rss_collection_last_success_timestamp_seconds) / 60
```

### absent() — Проверка отсутствия метрики

**Пример:**
```promql
absent(up{job="news-aggregator"})
```

**Что возвращает:**
- `1` — если метрика отсутствует
- Ничего — если метрика есть

**Зачем это нужно:**
Создать алерт на отсутствие метрики.

---

## Типичные ошибки

### Ошибка 1: Использование rate() без диапазона

**Неправильно:**
```promql
rate(http_requests_total)
```

**Ошибка:**
```
parse error: expected type range vector in call to function "rate", got instant vector
```

**Правильно:**
```promql
rate(http_requests_total[5m])
```

### Ошибка 2: Деление на ноль

**Проблема:**
```promql
rate(http_requests_total{status=~"5.."}[5m]) 
/ 
rate(http_requests_total[5m])
```

Если запросов нет — деление на ноль.

**Решение:**
```promql
rate(http_requests_total{status=~"5.."}[5m]) 
/ 
(rate(http_requests_total[5m]) or vector(1))
```

### Ошибка 3: Неправильный тип метрики

**Проблема:**
```promql
rate(nodejs_heap_size_used_bytes[5m])
```

`nodejs_heap_size_used_bytes` — это Gauge, а не Counter.

**Правильно:**
```promql
# Для Gauge используй delta()
delta(nodejs_heap_size_used_bytes[5m])
```

---

## Что дальше?

Теперь ты знаешь:
- ✅ Базовый синтаксис PromQL
- ✅ Типы данных (Instant/Range Vector)
- ✅ Арифметические операции
- ✅ Основные функции (rate, increase, sum)
- ✅ Как фильтровать и агрегировать данные

**Следующий шаг:** [Часть 8: Полезные функции PromQL](./08-promql-functions.md) →

Там ты узнаешь о продвинутых функциях для анализа метрик.
