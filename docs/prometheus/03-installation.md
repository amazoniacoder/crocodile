# Часть 3: Установка и первый запуск

> Пошаговая инструкция для Windows

---

## Что тебе понадобится

- ✅ Windows 10/11
- ✅ 500 MB свободного места на диске
- ✅ NewsAggregator уже установлен и работает
- ✅ 10 минут времени

---

## Шаг 1: Скачать Prometheus

### 1.1. Открой официальный сайт

https://prometheus.io/download/

### 1.2. Найди раздел "prometheus"

Ищи строку вида:
```
prometheus 2.50.0 / 2025-01-15
```

### 1.3. Скачай Windows версию

Кликни на ссылку:
```
prometheus-2.50.0.windows-amd64.zip
```

Размер: ~80 MB

### 1.4. Распакуй архив

1. Открой скачанный ZIP-файл
2. Извлеки содержимое в `D:\Prometheus\`

**Результат:**
```
D:\Prometheus\
├── prometheus.exe       (главная программа)
├── promtool.exe        (утилита для проверки конфигурации)
├── prometheus.yml      (конфигурация по умолчанию)
├── consoles\           (шаблоны для веб-интерфейса)
└── console_libraries\  (библиотеки для шаблонов)
```

---

## Шаг 2: Настроить конфигурацию

### 2.1. Открой файл конфигурации

Открой в текстовом редакторе:
```
D:\Prometheus\prometheus.yml
```

### 2.2. Замени содержимое на это:

```yaml
# Глобальные настройки
global:
  scrape_interval: 15s      # Как часто собирать метрики
  evaluation_interval: 15s  # Как часто проверять правила алертов
  external_labels:
    cluster: 'news-aggregator-prod'
    environment: 'production'

# Правила алертов
rule_files:
  - 'alerts.yml'

# Откуда собирать метрики
scrape_configs:
  # NewsAggregator
  - job_name: 'news-aggregator'
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/metrics'
    scrape_interval: 15s
    scrape_timeout: 10s

  # Prometheus сам себя
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

**Сохрани файл** (Ctrl+S).

### 2.3. Создай файл с правилами алертов

Создай новый файл:
```
D:\Prometheus\alerts.yml
```

Содержимое:

```yaml
groups:
  - name: news_aggregator_alerts
    interval: 30s
    rules:
      # Высокая частота ошибок HTTP
      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status=~"5.."}[5m]) 
          / 
          rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Высокая частота ошибок ({{ $value | humanizePercentage }})"
          description: "Более 5% запросов возвращают 5xx ошибки"

      # Медленные запросы
      - alert: SlowRequests
        expr: |
          histogram_quantile(0.95, 
            rate(http_request_duration_seconds_bucket[5m])
          ) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Медленные запросы (p95: {{ $value }}s)"
          description: "95-й перцентиль времени ответа превышает 2 секунды"

      # Высокое использование памяти
      - alert: HighMemoryUsage
        expr: nodejs_heap_size_used_bytes > 500000000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Высокое использование памяти ({{ $value | humanize1024 }})"
          description: "Heap превышает 500MB более 10 минут"

      # Критическое использование памяти
      - alert: CriticalMemoryUsage
        expr: nodejs_heap_size_used_bytes > 800000000
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "КРИТИЧЕСКОЕ использование памяти ({{ $value | humanize1024 }})"
          description: "Heap превышает 800MB — возможна утечка памяти"

      # RSS сбор остановлен
      - alert: RSSCollectionStalled
        expr: |
          time() - rss_collection_last_success_timestamp_seconds > 1800
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "RSS сбор не выполнялся более 30 минут"
          description: "Последний успешный сбор: {{ $value | humanizeDuration }}"

      # Низкая скорость сбора статей за сутки
      - alert: LowArticleCollectionRate
        expr: |
          sum(increase(rss_articles_collected_total[24h])) < 50
        for: 2h
        labels:
          severity: warning
        annotations:
          summary: "Низкая скорость сбора статей ({{ $value | humanize }}/день)"
          description: "Собрано менее 50 статей за последние 24 часа"

      # Prometheus недоступен
      - alert: PrometheusDown
        expr: up{job="news-aggregator"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "NewsAggregator недоступен для Prometheus"
          description: "Не удаётся собрать метрики с /metrics endpoint"
```

**Сохрани файл** (Ctrl+S).

---

## Шаг 3: Создать батник для запуска

### 3.1. Создай файл

Создай новый файл:
```
D:\Prometheus\start-prometheus.bat
```

### 3.2. Содержимое батника

```batch
@echo off
cd /d D:\Prometheus
echo Starting Prometheus with hot reload enabled...
echo.
echo Press Ctrl+C to stop Prometheus
echo.
prometheus.exe --config.file=prometheus.yml --storage.tsdb.path=data --storage.tsdb.retention.time=15d --web.enable-lifecycle
pause
```

**Сохрани файл**.

### 3.3. Что делают параметры?

| Параметр | Назначение |
|----------|-----------|
| `--config.file=prometheus.yml` | Путь к конфигурации |
| `--storage.tsdb.path=data` | Где хранить данные |
| `--storage.tsdb.retention.time=15d` | Хранить данные 15 дней |
| `--web.enable-lifecycle` | Разрешить hot reload конфигурации |

---

## Шаг 4: Запустить Prometheus

### 4.1. Убедись, что NewsAggregator работает

Открой в браузере:
```
http://localhost:5000/metrics
```

Должна открыться страница с метриками (текст, начинающийся с `# HELP`).

Если страница не открывается — запусти NewsAggregator:
```bash
cd D:\BlogPro
npm run dev
```

### 4.2. Запусти Prometheus

Двойной клик на:
```
D:\Prometheus\start-prometheus.bat
```

**Откроется окно с логами:**

```
Starting Prometheus with hot reload enabled...

Press Ctrl+C to stop Prometheus

ts=2025-05-06T14:30:00.000Z caller=main.go:123 level=info msg="Starting Prometheus" version="2.50.0"
ts=2025-05-06T14:30:00.100Z caller=main.go:456 level=info msg="Server is ready to receive web requests."
```

> ⚠️ **Важно:** Не закрывай это окно! Prometheus работает, пока окно открыто.

### 4.3. Проверь, что Prometheus запустился

Открой в браузере:
```
http://localhost:9090
```

Должна открыться главная страница Prometheus.

---

## Шаг 5: Проверить, что всё работает

### 5.1. Проверь targets

Открой:
```
http://localhost:9090/targets
```

**Что ты должен увидеть:**

| Endpoint | State | Labels |
|----------|-------|--------|
| http://localhost:5000/metrics | **UP** 🟢 | job="news-aggregator" |
| http://localhost:9090/metrics | **UP** 🟢 | job="prometheus" |

Если `news-aggregator` показывает **DOWN** 🔴:
1. Проверь, что NewsAggregator работает: `http://localhost:5000/api/health`
2. Подожди 15 секунд (scrape_interval)
3. Обнови страницу

### 5.2. Проверь метрики

Открой:
```
http://localhost:9090/graph
```

В поле **Expression** введи:
```promql
up
```

Нажми **Execute**.

**Результат:**

Должна появиться таблица:
```
up{instance="localhost:5000", job="news-aggregator"}  1
up{instance="localhost:9090", job="prometheus"}       1
```

Значение `1` = target работает.

### 5.3. Построй первый график

В поле **Expression** введи:
```promql
nodejs_heap_size_used_bytes / 1024 / 1024
```

Нажми **Execute**.

Переключись на вкладку **Graph**.

**Результат:**

Должен появиться график использования памяти Node.js в мегабайтах.

### 5.4. Проверь алерты

Открой:
```
http://localhost:9090/alerts
```

**Что ты должен увидеть:**

Список алертов из `alerts.yml`:
- HighErrorRate
- SlowRequests
- HighMemoryUsage
- CriticalMemoryUsage
- RSSCollectionStalled
- LowArticleCollectionRate
- PrometheusDown

Все должны быть в состоянии **Inactive** 🟢 (зелёные).

Если какой-то алерт в состоянии **Pending** 🟡 или **Firing** 🔴 — это нормально, если условие действительно выполнено (например, мало статей собрано).

---

## Шаг 6: Остановить Prometheus

### Вариант 1: Через окно

В окне с логами Prometheus нажми:
```
Ctrl+C
```

Prometheus остановится, окно покажет:
```
Для продолжения нажмите любую клавишу . . .
```

Нажми любую клавишу — окно закроется.

### Вариант 2: Через Task Manager

1. Открой Task Manager (Ctrl+Shift+Esc)
2. Найди процесс `prometheus.exe`
3. Кликни правой кнопкой → **End task**

---

## Типичные проблемы

### Проблема 1: "Порт 9090 уже занят"

**Ошибка в логах:**
```
listen tcp :9090: bind: Only one usage of each socket address is permitted.
```

**Причина:** Prometheus уже запущен.

**Решение:**
1. Закрой все окна Prometheus
2. Открой Task Manager → убей процесс `prometheus.exe`
3. Запусти снова

### Проблема 2: Target "news-aggregator" DOWN

**Причина:** NewsAggregator не работает или `/metrics` недоступен.

**Решение:**
1. Проверь: `http://localhost:5000/metrics` открывается в браузере?
2. Если нет — запусти NewsAggregator: `npm run dev`
3. Подожди 15 секунд
4. Обнови страницу Targets

### Проблема 3: "No such file or directory: alerts.yml"

**Ошибка в логах:**
```
error loading rules: open alerts.yml: no such file or directory
```

**Причина:** Файл `alerts.yml` не создан или находится не в той папке.

**Решение:**
1. Убедись, что файл `D:\Prometheus\alerts.yml` существует
2. Проверь, что батник запускается из папки `D:\Prometheus`

### Проблема 4: Окно Prometheus сразу закрывается

**Причина:** Ошибка в конфигурации.

**Решение:**
1. Открой `cmd.exe`
2. Перейди в папку:
   ```cmd
   cd D:\Prometheus
   ```
3. Запусти вручную:
   ```cmd
   prometheus.exe --config.file=prometheus.yml
   ```
4. Прочитай ошибку в консоли
5. Исправь конфигурацию

### Проблема 5: Графики пустые

**Причина:** Prometheus только что запустился, данных ещё нет.

**Решение:**
1. Подожди 30 секунд
2. Обнови страницу
3. Проверь, что target UP

---

## Проверка конфигурации

### Проверить синтаксис prometheus.yml

```cmd
cd D:\Prometheus
promtool check config prometheus.yml
```

**Результат:**
```
Checking prometheus.yml
  SUCCESS: 2 rule files found
```

### Проверить синтаксис alerts.yml

```cmd
cd D:\Prometheus
promtool check rules alerts.yml
```

**Результат:**
```
Checking alerts.yml
  SUCCESS: 7 rules found
```

---

## Автозапуск (опционально)

Если хочешь, чтобы Prometheus запускался автоматически при старте Windows:

### Вариант 1: Добавить в автозагрузку

1. Нажми `Win+R`
2. Введи: `shell:startup`
3. Скопируй туда ярлык на `start-prometheus.bat`

**Минус:** Окно будет открываться при каждом запуске Windows.

### Вариант 2: Установить как Windows Service

Скачай NSSM: https://nssm.cc/download

```cmd
cd D:\Prometheus
nssm install Prometheus "D:\Prometheus\prometheus.exe"
nssm set Prometheus AppParameters "--config.file=D:\Prometheus\prometheus.yml --storage.tsdb.path=D:\Prometheus\data --storage.tsdb.retention.time=15d --web.enable-lifecycle"
nssm set Prometheus AppDirectory "D:\Prometheus"
nssm set Prometheus DisplayName "Prometheus Monitoring"
nssm set Prometheus Start SERVICE_AUTO_START
nssm start Prometheus
```

**Плюс:** Работает в фоне, автоматический запуск.

**Минус:** Логи нужно смотреть через Event Viewer.

---

## Что дальше?

Теперь ты умеешь:
- ✅ Устанавливать Prometheus
- ✅ Настраивать конфигурацию
- ✅ Запускать и останавливать
- ✅ Проверять статус targets
- ✅ Строить простые графики
- ✅ Решать типовые проблемы

**Следующий шаг:** [Часть 4: Обзор веб-интерфейса](./04-web-ui-basics.md) →

Там ты узнаешь, как пользоваться всеми возможностями веб-интерфейса Prometheus.
