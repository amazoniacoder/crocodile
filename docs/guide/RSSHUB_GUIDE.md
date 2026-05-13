# RSSHub — Руководство для NewsAggregator

## Что такое RSSHub

[RSSHub](https://github.com/DIYgod/RSSHub) — open-source сервис, который генерирует RSS-ленты для сайтов, у которых нет публичного RSS. Содержит 1500+ готовых роутов для популярных ресурсов. Запускается локально или на сервере, агрегатор обращается к нему как к обычному RSS-источнику.

**Зачем он нужен в этом проекте:**  
Ряд крупных источников (ТАСС, Reuters) не предоставляют тематические RSS-ленты напрямую или закрыты DNS-блокировками из РФ. RSSHub решает обе проблемы — генерирует тематические ленты и может быть развёрнут на зарубежном сервере.

---

## Что подключено через RSSHub

### Доступно из РФ (localhost:1200)

| Источник | RSSHub путь | region | category |
|----------|-------------|--------|----------|
| ТАСС — Мир | `/tass/world` | world | other |
| ТАСС — Политика | `/tass/politics` | russia | politics |
| ТАСС — Экономика | `/tass/economy` | russia | economy |
| ТАСС — Наука | `/tass/science` | russia | tech |
| ТАСС — Общество | `/tass/society` | russia | society |
| ТАСС — Спорт | `/tass/sport` | russia | society |
| Reuters — Мир | `/reuters/world` | world | other |
| Reuters — Бизнес | `/reuters/business` | world | economy |
| Reuters — Технологии | `/reuters/technology` | world | tech |
| Reuters — Рынки | `/reuters/markets` | world | economy |
| Sputnik — Россия | `/sputniknews/russia` | russia | other |
| Sputnik — Мир | `/sputniknews/world` | world | other |

### Только с зарубежного сервера (заблокированы ТСПУ из РФ)

| Источник | RSSHub путь | region | category |
|----------|-------------|--------|----------|
| BBC — Мир | `/bbc/world` | world | other |
| BBC — Технологии | `/bbc/technology` | world | tech |
| BBC — Бизнес | `/bbc/business` | world | economy |
| BBC — Наука | `/bbc/science` | world | tech |
| BBC — Политика | `/bbc/politics` | world | politics |
| DW — Все новости RU | `/dw/ru` | world | other |
| DW — Экономика RU | `/dw/ru-economy` | world | economy |
| DW — Политика RU | `/dw/ru-politics` | world | politics |
| AP News — Мир | `/apnews/world-news` | world | other |
| AP News — Политика | `/apnews/politics` | world | politics |
| AP News — Бизнес | `/apnews/business` | world | economy |
| AP News — Технологии | `/apnews/technology` | world | tech |
| NYT — Главное | `/nytimes/homepage` | world | other |
| NYT — Мир | `/nytimes/world` | world | other |
| NYT — Бизнес | `/nytimes/business` | world | economy |
| NYT — Технологии | `/nytimes/technology` | world | tech |

---

## Расположение на диске

```
D:\RSSHub\          — исходный код (клонирован с GitHub)
D:\RSSHub\dist\     — production сборка (создаётся после npm run build)
```

---

## Способы запуска

### 1. Режим разработки (текущий, без сборки)

Самый простой способ — запускает напрямую из исходников через `tsx`:

```cmd
cd D:\RSSHub
npm run dev
```

Доступно на: `http://localhost:1200`

Подходит для локальной разработки. При закрытии терминала — останавливается.

---

### 2. Production запуск (требует сборки)

```cmd
cd D:\RSSHub
npm run build
npm run start
```

`npm run build` выполняет две операции:
1. `build:routes` — генерирует индекс всех роутов
2. `tsdown` — компилирует TypeScript в `dist/index.mjs`

После сборки `dist/index.mjs` можно запускать напрямую:

```cmd
node dist/index.mjs
```

---

### 3. Через PM2 (автозапуск при перезагрузке Windows)

```cmd
npm install -g pm2

cd D:\RSSHub
npm run build

pm2 start dist/index.mjs --name rsshub
pm2 save
pm2 startup
```

Управление:
```cmd
pm2 status          # статус всех процессов
pm2 logs rsshub     # логи в реальном времени
pm2 restart rsshub  # перезапуск
pm2 stop rsshub     # остановка
```

---

### 4. Через Docker (рекомендуется для production)

Готовый `docker-compose.yml` находится в `D:\BlogPro\docs\rsshub-docker-compose.yml`:

```cmd
docker-compose -f D:\BlogPro\docs\rsshub-docker-compose.yml up -d
```

Включает RSSHub + Redis для кэширования. Автоматически перезапускается при перезагрузке.

Остановка:
```cmd
docker-compose -f D:\BlogPro\docs\rsshub-docker-compose.yml down
```

---

## Проверка работоспособности

```cmd
curl http://localhost:1200
```

Должен вернуть HTML-страницу RSSHub. Проверка конкретного роута:

```cmd
curl -s -o nul -w "%{http_code}" http://localhost:1200/tass/world
```

Должен вернуть `200`.

---

## Подключение источников в БД

Источники в `news_sources` уже прописаны с `rss_url = 'http://localhost:1200/...'`. Они активируются автоматически когда RSSHub запущен.

Проверить какие источники используют RSSHub:

```sql
SELECT name, rss_url, is_active
FROM news_sources
WHERE rss_url LIKE '%localhost:1200%'
ORDER BY name;
```

Если RSSHub не запущен — эти источники будут падать с `ECONNREFUSED` и логироваться как `Source unavailable (network)` — не как ошибка, просто предупреждение.

---

## Деплой на зарубежный сервер

Для источников заблокированных из РФ (BBC, DW, AP News, NYT) — RSSHub нужно запустить на зарубежном сервере.

**1. Запустить через Docker на сервере:**

```bash
docker-compose -f rsshub-docker-compose.yml up -d
```

**2. Заменить localhost на IP сервера в БД:**

```sql
UPDATE news_sources
SET rss_url = REPLACE(rss_url, 'localhost:1200', 'YOUR_SERVER_IP:1200')
WHERE rss_url LIKE '%localhost:1200%';
```

**3. Активировать заблокированные источники:**

```sql
UPDATE news_sources
SET is_active = true
WHERE name IN (
  'BBC — Мир', 'BBC — Технологии', 'BBC — Бизнес', 'BBC — Наука', 'BBC — Политика',
  'DW — Все новости RU', 'DW — Экономика RU', 'DW — Политика RU',
  'AP News — Мир', 'AP News — Политика', 'AP News — Бизнес', 'AP News — Технологии',
  'NYT — Главное', 'NYT — Мир', 'NYT — Бизнес', 'NYT — Технологии'
);
```

---

## Добавление нового источника через RSSHub

Найти роут на [rsshub.app](https://rsshub.app) или в [документации](https://docs.rsshub.app):

```sql
INSERT INTO news_sources (name, url, rss_url, region, category)
VALUES (
  'Название источника',
  'https://site.com',
  'http://localhost:1200/route/path',
  'world',
  'other'
);
```

---

## Переменные окружения RSSHub (опционально)

Создать `D:\RSSHub\.env` для настройки:

```env
# Защита доступа (если RSSHub открыт в интернете)
ACCESS_KEY=your_secret_key

# Кэширование
CACHE_TYPE=redis
REDIS_URL=redis://localhost:6379/

# Таймаут запросов (мс)
REQUEST_TIMEOUT=8000

# Порт (default: 1200)
PORT=1200
```

При использовании `ACCESS_KEY` — добавить ключ в URL источников:

```
http://localhost:1200/tass/world?key=your_secret_key
```

---

## Известные ограничения

| Источник | Статус | Причина |
|----------|--------|---------|
| Фонтанка.ру | ❌ | Нет готового роута в RSSHub |
| b-port.com (Мурманск) | ❌ | Нет готового роута в RSSHub |
| BezFormata | ❌ | Нет готового роута в RSSHub |
| BBC / DW / AP / NYT | ⚠️ только с зарубежного сервера | Заблокированы ТСПУ из РФ |

---

## Городские источники — статус и план

### Работают сейчас (прямой RSS)

| Источник | Город | RSS URL |
|----------|-------|---------|
| Полуостров Камчатка | Петропавловск-Камчатский | `poluostrov-kamchatka.ru/rss/` |
| Портамур | Благовещенск | `portamur.ru/news/rss.php` |
| АСН24 | Благовещенск | `asn24.ru/news/rss.php` |
| Todaykhv | Хабаровск | `todaykhv.ru/rss/` |
| Dvnovosti | Хабаровск | `dvnovosti.ru/rss/` |

### Не работают — сломан RSS на стороне сайта

| Источник | Город | Причина |
|----------|-------|---------|
| PrimaMedia | Владивосток | Отдаёт `text/html` вместо RSS |
| Nord-News | Мурманск | Отдаёт `text/html` вместо RSS |
| dvhab.ru | Хабаровск | Заменён на Todaykhv + Dvnovosti |
| Амур.инфо | Благовещенск | Заменён на Портамур + АСН24 |

### Добавить при деплое на зарубежный сервер

Свобода.org и региональные проекты RFE/RL заблокированы ТСПУ — DNS не резолвится из РФ.
С зарубежного сервера доступны напрямую без RSSHub.

```sql
INSERT INTO news_sources (name, url, rss_url, region, category, city) VALUES
  -- Свобода — общие ленты
  ('Свобода — Россия',      'https://www.svoboda.org', 'https://www.svoboda.org/z/632',        'russia', 'other',    NULL),
  ('Свобода — Мир',         'https://www.svoboda.org', 'https://www.svoboda.org/z/631',        'world',  'other',    NULL),
  -- Север.Реалии — Мурманск и Арктика
  ('Север.Реалии',          'https://www.severreal.org', 'https://www.severreal.org/z/631',    'russia', 'other',    'Мурманск'),
  -- Сибирь.Реалии — Дальний Восток
  ('Сибирь.Реалии',         'https://www.sibreal.org',   'https://www.sibreal.org/z/631',      'russia', 'other',    'Владивосток')
ON CONFLICT DO NOTHING;
```

> RSS-пути (`/z/631`, `/z/632`) — стандартный паттерн RFE/RL. Точные ID лент уточнить на `svoboda.org/rssfeeds` после деплоя на зарубежный сервер.
