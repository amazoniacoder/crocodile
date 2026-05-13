# Система погоды — Гайд для разработчиков

> **Версия:** 2.1.0
> **Статус:** Production
> **Обновлено:** Май 2025

---

## Обзор системы

Модуль погоды предоставляет прогноз на 7 дней для 51 города России с почасовой детализацией, фазами луны, геомагнитной активностью и UV-индексом. Включает публичную страницу `/weather` и виджет на главной странице.

### Ключевые возможности

- **Прогноз на 7 дней:** температура, ощущаемая температура, осадки, вероятность осадков, влажность, ветер, давление, UV-индекс
- **Почасовая детализация:** 168 часов (7×24), кэшируется в БД
- **Астрономические данные:** фазы луны (математический расчёт), % освещённости
- **Геомагнитная активность:** Kp-индекс от NOAA
- **Ночные иконки:** коды 0, 1, 2 — ночные SVG с 21:00 до 05:00
- **Офлайн-режим:** IndexedDB кэш + Service Worker
- **Синхронизация города:** виджет и страница используют единый ключ `localStorage`
- **Адаптивный дизайн:** мобильные свайпы, горизонтальный скролл, боковая панель

---

## Архитектура

### Источники данных

| Источник | Назначение | Лимиты |
|----------|------------|--------|
| **Open-Meteo** | Прогноз погоды, геокодинг | 10K req/день (бесплатно) |
| **NOAA Space Weather** | Kp-индекс геомагнитной активности | Без лимитов |
| **Математический расчёт** | Фазы луны (алгоритм Конвея) | Локально |

### База данных

```sql
-- 3 таблицы
weather_locations          -- 51 город России
weather_forecasts          -- дневные прогнозы (UNIQUE: location_id, forecast_date)
weather_hourly_forecasts   -- почасовые прогнозы (UNIQUE: location_id, forecast_dt)
```

### Поток данных

```
[Cron каждые 3 часа]
  → WeatherCollectionService
    → Open-Meteo API (дневной прогноз 7 дней: temp, precipitation, wind, humidity, UV)
    → NOAA API (Kp-индекс, один запрос на весь цикл)
    → MoonPhaseCalculator (локально)
    → INSERT weather_forecasts ON CONFLICT DO UPDATE
    → Open-Meteo API (почасовка 7 дней: temp, apparent_temp, wind, precipitation, pressure)
    → Вычисление среднесуточного давления → UPDATE weather_forecasts.pressure_hpa
    → INSERT weather_hourly_forecasts батчами по 100 ON CONFLICT DO UPDATE
    → QueryCache invalidation (тег 'weather')

[Cron воскресенье 06:00]
  → executeWeatherCleanup()
    → DELETE weather_forecasts WHERE forecast_date < NOW() - 14 days
    → DELETE weather_hourly_forecasts WHERE forecast_dt < NOW() - 10 days

[GET /api/weather/week]
  → PostgreSQL (дневные прогнозы)
  → PostgreSQL (почасовка из weather_hourly_forecasts)
  → Fallback: Open-Meteo если БД пуста
  → Redis cache (TTL 1 час)

[WeatherPage]
  → useWeatherData → fetch('/api/weather/week') → IndexedDB cache
  → useHourlyData → данные из weekHourly или fallback /api/weather/hourly
  → Service Worker (офлайн fallback из IndexedDB)
```

---

## API Endpoints

### Публичные (с rate limiting)

| Метод | Путь | Кэш | Описание |
|-------|------|-----|----------|
| GET | `/api/weather/locations` | 1ч | Список активных городов |
| GET | `/api/weather/week?locationId=1` | 1ч | 7 дней + 168 часов из БД |
| GET | `/api/weather?locationId=1` | — | Только дневные прогнозы |
| GET | `/api/weather/hourly?locationId=1&date=2025-05-15` | 1ч | Один день почасовки из БД |

### Административные

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/admin/weather/locations` | Все города (включая неактивные) |
| POST | `/api/admin/weather/locations` | Добавить город |
| PATCH | `/api/admin/weather/locations/:id` | Изменить город |
| DELETE | `/api/admin/weather/locations/:id` | Удалить город |
| POST | `/api/admin/weather/collect` | Ручной запуск сбора |

---

## Серверная часть

### Структура файлов

```
server/
├── api/weather/index.ts                    # Публичные эндпоинты (БД-first, fallback Open-Meteo)
├── api/admin/weather/index.ts              # Админские эндпоинты
├── application/weather/
│   └── WeatherCollectionService.ts         # Сбор, сохранение почасовки, очистка, cron
└── infrastructure/weather/
    ├── OpenMeteoClient.ts                  # fetchForecast, fetchHourlyRange, fetchHourly, geocodeCity
    ├── NoaaKpClient.ts                     # getCurrentKpIndex
    └── MoonPhaseCalculator.ts              # getMoonPhase (алгоритм Конвея)
```

### WeatherCollectionService

**Логика сбора за один цикл:**
1. Один запрос `getCurrentKpIndex()` на весь цикл
2. Для каждого города:
   - `fetchForecast()` → 7 дней → `INSERT weather_forecasts ON CONFLICT DO UPDATE`
   - `fetchHourlyRange()` → 168 часов → вычисление среднесуточного давления → `UPDATE weather_forecasts.pressure_hpa`
   - Батчевая вставка почасовки в `weather_hourly_forecasts` (по 100 строк)
3. Инвалидация кэша по тегу `weather`

**Cron:**
- Сбор: каждые 3 часа (`0 */3 * * *`) + первый прогон через 10 секунд
- Очистка: каждое воскресенье в 06:00 (`0 6 * * 0`)

### OpenMeteoClient — запрашиваемые поля

**Дневной прогноз (`fetchForecast`):**
```
temperature_2m_max, temperature_2m_min, precipitation_sum,
windspeed_10m_max, wind_gusts_10m_max, winddirection_10m_dominant, weathercode,
precipitation_probability_max, relative_humidity_2m_max, uv_index_max
```

**Почасовой прогноз (`fetchHourlyRange`):**
```
temperature_2m, apparent_temperature, weathercode,
windspeed_10m, wind_gusts_10m, winddirection_10m, precipitation, surface_pressure
```

---

## Клиентская часть

### Структура файлов

```
client/src/
├── pages/WeatherPage.tsx                   # Оркестрация state + render (~130 строк)
├── components/weather/
│   ├── WeatherDaySummary.tsx               # Карточка дня + метаданные (WeatherMetaContent)
│   ├── WeatherTabs.tsx                     # Вкладки 7 дней (день + температура + иконка)
│   ├── WeatherHourlyTable.tsx              # Почасовая таблица, date-bar, автоскролл
│   ├── WeatherMetaSidebar.tsx              # Мобильная боковая панель (кнопка-полумесяц)
│   ├── WeatherIcon.tsx                     # SVG WMO (дневные/ночные), MoonIcon, WindBadge
│   ├── WeatherWidget.tsx                   # Выдвижная панель на главной
│   ├── WeatherOfflineIndicator.tsx
│   └── CitySearchInput.tsx                 # Умный поиск с фильтрацией по 51 городу
├── hooks/
│   ├── useWeatherData.ts                   # fetch городов и прогнозов, кэш, storage sync
│   └── useHourlyData.ts                    # Почасовые данные для выбранного дня
├── types/
│   └── weather.ts                          # WeatherLocation, WeatherForecast, HourlyRow
├── utils/
│   └── weather.ts                          # DAY_NAMES, formatTab, tempBarClass, kpClass, uvClass, uvLabel
├── services/
│   ├── weatherDb.ts / weatherCache.ts      # IndexedDB кэш недели (Dexie, TTL 1ч, GC 7 дней)
│   └── ...
└── ui-system/patterns/weather.css          # Все стили модуля погоды
```

### WeatherPage — архитектура

```
WeatherPage (оркестрация)
  ├── useWeatherData     — загрузка городов и прогнозов, кэш, онлайн-обновление, storage sync
  ├── useHourlyData      — почасовые данные для выбранного дня (2-дневное окно)
  ├── WeatherDaySummary  — карточка текущей погоды + метаданные дня
  ├── WeatherTabs        — вкладки 7 дней (день + температура + иконка)
  ├── WeatherHourlyTable — таблица с date-bar, автоскролл, индикаторы
  └── WeatherMetaSidebar — мобильная панель (выезжает справа по кнопке-полумесяцу)
```

### Особенности таблицы

- Двухслойная архитектура: левая фиксированная полоса + правая скроллируемая таблица
- `table-layout: fixed` — ширина колонок не зависит от содержимого
- Date-bar «Сегодня / Завтра» — `sticky left:0` + `translateX` синхронизирован через `scroll`-событие
- Автоскролл к текущему часу учитывает timezone города через `Intl.DateTimeFormat`
- Строки таблицы: иконка, температура + индикаторная полоска, ощущаемая температура, осадки, ветер, давление, геомагнитная активность
- Индикаторная полоска температуры (10px, 5 градаций: синий→голубой→жёлтый→оранжевый→красный)
- `WindBadge` — бейдж с аббревиатурой + SVG-стрелка повёрнутая на `(deg+180)°`
- `MoonIcon` — SVG с тёмной/светлой половинами по фазе, тултип с % освещённости

### Ночные иконки и описания

`isNightHour(hour)` — `true` если `hour >= 21 || hour < 5`

| Код | День | Ночь |
|-----|------|------|
| 0 | Ясно (солнце) | Ясная ночь (луна + звёзды) |
| 1 | Преимущественно ясно | Преимущественно ясная ночь |
| 2 | Переменная облачность | Переменная облачность ночью |
| 3+ | Без изменений | Без изменений |

### WeatherWidget

- Умный поиск города (`CitySearchInput`) — фильтрация по списку 51 города
- Сегодня + следующие 3 дня с иконками
- Ссылка на полную страницу `/weather`
- Единый ключ `localStorage`: `weather:selected-city` — синхронизация со страницей через `storage` event

### Синхронизация города виджет ↔ страница

```typescript
// useWeatherData.ts — реагирует на смену города в виджете
window.addEventListener('storage', (e) => {
  if (e.key === 'weather:selected-city') setSelectedIdState(parseInt(e.newValue));
});

// WeatherWidget.tsx — реагирует на смену города на странице
window.addEventListener('storage', (e) => {
  if (e.key === 'weather:selected-city') setSelectedIdLocal(parseInt(e.newValue));
});
```

---

## Схема БД

### weather_locations

```sql
CREATE TABLE weather_locations (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  name_en     VARCHAR(100) NOT NULL,
  country     VARCHAR(50)  DEFAULT 'Russia',
  latitude    DECIMAL(8,5) NOT NULL,
  longitude   DECIMAL(8,5) NOT NULL,
  timezone    VARCHAR(50)  DEFAULT 'Europe/Moscow',
  is_active   BOOLEAN      DEFAULT true,
  sort_order  INTEGER      DEFAULT 0,
  created_at  TIMESTAMP    DEFAULT NOW()
);
```

### weather_forecasts

```sql
CREATE TABLE weather_forecasts (
  id                           SERIAL PRIMARY KEY,
  location_id                  INTEGER REFERENCES weather_locations(id) ON DELETE CASCADE,
  forecast_date                DATE NOT NULL,
  temp_min                     DECIMAL(4,1),       -- °C
  temp_max                     DECIMAL(4,1),       -- °C
  precipitation_mm             DECIMAL(5,1),       -- мм осадков
  precipitation_probability_pct INTEGER,           -- % вероятность осадков
  wind_speed_kmh               DECIMAL(5,1),       -- км/ч
  wind_direction_deg           INTEGER,
  humidity_pct                 INTEGER,            -- % реальная влажность воздуха
  pressure_hpa                 DECIMAL(6,1),       -- гПа (среднесуточное из почасовки)
  weather_code                 INTEGER,            -- WMO код
  moon_phase                   DECIMAL(4,3),       -- 0.0-1.0
  moon_phase_name              VARCHAR(30),
  kp_index                     DECIMAL(3,1),       -- 0-9
  kp_level                     VARCHAR(20),
  uv_index_max                 DECIMAL(3,1),       -- UV-индекс максимальный за день
  fetched_at                   TIMESTAMP DEFAULT NOW(),
  UNIQUE(location_id, forecast_date)
);
```

### weather_hourly_forecasts

```sql
CREATE TABLE weather_hourly_forecasts (
  id            SERIAL PRIMARY KEY,
  location_id   INTEGER NOT NULL REFERENCES weather_locations(id) ON DELETE CASCADE,
  forecast_dt   TIMESTAMP NOT NULL,        -- UTC
  temp          DECIMAL(4,1),              -- °C
  apparent_temp DECIMAL(4,1),              -- °C ощущаемая
  weather_code  INTEGER,
  wind_speed    DECIMAL(5,1),              -- км/ч
  wind_dir      INTEGER,
  precipitation DECIMAL(5,1),             -- мм
  pressure_hpa  DECIMAL(6,1),             -- гПа
  fetched_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE(location_id, forecast_dt)
);

CREATE INDEX idx_weather_hourly_location_dt ON weather_hourly_forecasts(location_id, forecast_dt);
CREATE INDEX idx_weather_hourly_dt ON weather_hourly_forecasts(forecast_dt);
```

---

## Типы данных (клиент)

```typescript
// client/src/types/weather.ts

interface WeatherForecast {
  forecastDate: string;
  tempMin: string | null;
  tempMax: string | null;
  precipitationMm: string | null;
  precipitationProbabilityPct: number | null;  // % вероятность осадков
  windSpeedKmh: string | null;
  windGustsKmh: string | null;                 // порывы ветра
  windDirectionDeg: number | null;
  humidityPct: number | null;                  // % реальная влажность
  pressureHpa: string | null;                  // среднесуточное давление
  weatherCode: number | null;
  moonPhaseName: string | null;
  moonPhase: string | null;
  kpIndex: string | null;
  kpLevel: string | null;
  uvIndexMax: string | null;                   // UV-индекс
}

interface HourlyRow {
  date: string;
  time: string;
  temp: number | null;
  apparentTemp: number | null;                 // ощущаемая температура
  weatherCode: number | null;
  windSpeed: number | null;
  windGusts: number | null;                    // порывы ветра
  windDirection: number | null;
  precipitation: number | null;
  pressureHpa: number | null;
}
```

---

## UV-индекс — уровни

| UV | Уровень | Цвет |
|----|---------|------|
| 0–2 | Низкий | Зелёный |
| 3–5 | Умеренный | Жёлтый |
| 6–7 | Высокий | Оранжевый |
| 8–10 | Очень высокий | Красный |
| 11+ | Экстремальный | Фиолетовый |

Функции: `uvClass(uv)`, `uvLabel(uv)` в `client/src/utils/weather.ts`.

---

## Производительность

### Оптимизации

1. **Почасовка в БД:** `weather_hourly_forecasts` — `/api/weather/week` читает из БД, Open-Meteo только при промахе
2. **Батчевая вставка:** почасовка вставляется батчами по 100 строк
3. **Один Kp-запрос:** на весь цикл сбора
4. **Среднесуточное давление:** вычисляется из почасовки при сборе, не при запросе
5. **Redis кэш:** TTL 1 час для `/week` и `/locations`
6. **IndexedDB:** офлайн-кэш недели (TTL 1 час, GC 7 дней)

### Лимиты API

| Сервис | Лимит | Текущее использование |
|--------|-------|----------------------|
| Open-Meteo | 10K req/день | ~400 req/день при сборе (51 × 2 запроса × 4 цикла) |
| NOAA | Без лимитов | 8 req/день |

### Очистка данных

| Таблица | Retention | Cron |
|---------|-----------|------|
| `weather_forecasts` | 14 дней | Воскресенье 06:00 |
| `weather_hourly_forecasts` | 10 дней | Воскресенье 06:00 |

---

## Миграции

| Файл | Изменение |
|------|-----------|
| `0014_add_weather.sql` | Таблицы `weather_locations`, `weather_forecasts` |
| `0015_weather_precipitation_probability.sql` | Поле `precipitation_probability_pct` |
| `0016_weather_hourly_forecasts.sql` | Таблица `weather_hourly_forecasts` |
| `0017_weather_apparent_temp.sql` | Поле `apparent_temp` в почасовке |
| `0018_weather_uv_index.sql` | Поле `uv_index_max` в дневных прогнозах |
| `0019_add_wind_gusts.sql` | Поля `wind_gusts_kmh` (дневные), `wind_gusts` (почасовка) |

```bash
npx drizzle-kit migrate
```

---

## Мониторинг и админка

### Zone K — Кабинет мониторинга

Доступ: `/admin-monitor` → Zone K

- Список всех городов (активные/неактивные)
- Добавление нового города через геокодинг
- Изменение статуса и порядка сортировки
- Ручной запуск сбора погоды
- Статистика последнего сбора

---

## Тестирование

```
server/__tests__/
├── OpenMeteoClient.test.ts      # Unit: fetchHourlyRange
└── weather-week-api.test.ts     # Integration: GET /api/weather/week

client/src/__tests__/
└── weatherCache.test.ts         # Unit: IndexedDB операции
```

```bash
# Ручной запуск сбора
curl -X POST http://localhost:5000/api/admin/weather/collect \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Проверка API
curl "http://localhost:5000/api/weather/week?locationId=1"
```

---

## Частые задачи

### Добавить новый город

```bash
curl -X POST http://localhost:5000/api/admin/weather/locations \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Сочи", "nameEn": "Sochi"}'
```

### Изменить интервал сбора

В `WeatherCollectionService.ts`:
```typescript
nodeCron.schedule('0 */6 * * *', async () => { // каждые 6 часов
```

### Отладка офлайн-режима

```javascript
// DevTools Console
await weatherDb.daily.where('locationId').equals(1).toArray();
await clearAllWeatherCache();
```

---

## Roadmap

1. Расширение географии: города СНГ, Европа
2. Погодные алерты: штормовые предупреждения
3. Исторические данные: сравнение с прошлым годом
4. Push-уведомления: критические изменения погоды
