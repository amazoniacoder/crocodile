# Prometheus — Полное руководство для начинающих

> Пошаговый гайд по работе с Prometheus для мониторинга NewsAggregator

---

## 📚 Содержание

### Часть 1: Основы
- **[01-what-is-prometheus.md](./01-what-is-prometheus.md)** — Что такое Prometheus и зачем он нужен
- **[02-architecture.md](./02-architecture.md)** — Как работает Prometheus (архитектура)
- **[03-installation.md](./03-installation.md)** — Установка и первый запуск

### Часть 2: Работа с интерфейсом
- **[04-web-ui-basics.md](./04-web-ui-basics.md)** — Обзор веб-интерфейса
- **[05-targets.md](./05-targets.md)** — Мониторинг targets (источников метрик)
- **[06-alerts.md](./06-alerts.md)** — Работа с алертами

### Часть 3: Язык запросов PromQL
- **[07-promql-basics.md](./07-promql-basics.md)** — Основы PromQL
- **[08-promql-functions.md](./08-promql-functions.md)** — Полезные функции
- **[09-promql-examples.md](./09-promql-examples.md)** — Практические примеры для NewsAggregator

### Часть 4: Конфигурация
- **[10-prometheus-yml.md](./10-prometheus-yml.md)** — Настройка prometheus.yml
- **[11-alerts-yml.md](./11-alerts-yml.md)** — Создание правил алертов
- **[12-hot-reload.md](./12-hot-reload.md)** — Перезагрузка конфигурации без остановки

### Часть 5: Практика
- **[13-daily-tasks.md](./13-daily-tasks.md)** — Ежедневные задачи мониторинга
- **[14-troubleshooting.md](./14-troubleshooting.md)** — Решение типовых проблем
- **[15-best-practices.md](./15-best-practices.md)** — Лучшие практики

### Часть 6: Интеграция
- **[16-api.md](./16-api.md)** — HTTP API Prometheus
- **[17-exporters.md](./17-exporters.md)** — Работа с экспортёрами
- **[18-alertmanager.md](./18-alertmanager.md)** — Настройка уведомлений (опционально)

---

## 🚀 Быстрый старт

Если нужно быстро начать работу:

1. Прочитай **Часть 1** (основы) — 15 минут
2. Открой http://localhost:9090 и следуй **Части 2** (интерфейс) — 10 минут
3. Попробуй примеры из **Части 3** (PromQL) — 20 минут

**Итого:** за 45 минут освоишь базовый мониторинг.

---

## 📖 Для кого этот гайд

- ✅ Ты впервые работаешь с Prometheus
- ✅ Тебе нужно мониторить NewsAggregator
- ✅ Ты хочешь понять, как работают метрики и алерты
- ✅ Тебе нужны практические примеры, а не теория

---

## 🎯 Что ты узнаешь

После прочтения гайда ты сможешь:

- Запускать и останавливать Prometheus
- Проверять статус сервисов через веб-интерфейс
- Писать запросы на PromQL для анализа метрик
- Создавать и настраивать алерты
- Диагностировать проблемы с производительностью
- Экспортировать данные для отчётов

---

## 💡 Соглашения в гайде

**Команды для терминала:**
```bash
# Это команда для выполнения
curl http://localhost:9090/api/v1/query?query=up
```

**Запросы PromQL:**
```promql
# Это запрос для Graph в веб-интерфейсе
rate(http_requests_total[5m])
```

**Конфигурация YAML:**
```yaml
# Это содержимое файла prometheus.yml
global:
  scrape_interval: 15s
```

**Важные замечания:**
> ⚠️ **Важно:** Критическая информация, которую нельзя пропустить

> 💡 **Совет:** Полезная рекомендация для упрощения работы

> 📝 **Примечание:** Дополнительная информация для понимания

---

## 🔗 Связанные документы

- [PROMETHEUS_GRAFANA_SETUP.md](../PROMETHEUS_GRAFANA_SETUP.md) — Полная инструкция по установке
- [PROMETHEUS_QUICK_START.md](../PROMETHEUS_QUICK_START.md) — Краткий справочник
- [DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md) — Руководство разработчика NewsAggregator

---

## 📅 Версия документа

- **Дата создания:** Май 2025
- **Версия Prometheus:** 2.50+
- **Версия NewsAggregator:** 2.1.0
- **Статус:** Production-ready

---

**Начни с [Части 1: Что такое Prometheus](./01-what-is-prometheus.md)** →
