# Слайды для Эпизода 2: "Архитектура и технологический стек"

> **Презентация:** 25-30 слайдов для 22-25 минут эпизода

---

## 🎯 Структура презентации

### Слайд 1: Заставка серии
```
NewsAggregator — Enterprise Architecture
Эпизод 2: "Архитектура и технологический стек"

🏗️ Domain-Driven Design в реальном проекте
⚡ EventBus для слабой связанности  
💻 Обоснованный выбор технологий
🚀 Production-ready решения
```

### Слайд 2: План эпизода
```
Что узнаем сегодня:

1️⃣ Проблемы сложности в Enterprise
2️⃣ Domain-Driven Design принципы
3️⃣ Четыре слоя архитектуры
4️⃣ EventBus и слабая связанность
5️⃣ Технологический стек
6️⃣ Практический разбор кода
```

---

## 🚫 Блок 1: Проблемы сложности (слайды 3-6)

### Слайд 3: Рост сложности
```
Enterprise vs Простой проект

Простой проект          Enterprise система
┌─────────────┐        ┌─────────────────────────┐
│ 1 файл      │   →    │ 50,000+ строк кода      │
│ 1 функция   │        │ 20 таблиц БД            │
│ 1 разработчик│        │ 15+ интеграций          │
│ Локальный   │        │ 10+ разработчиков       │
└─────────────┘        │ 24/7 availability       │
                       └─────────────────────────┘

Сложность растет экспоненциально! 📈
```

### Слайд 4: Типичные проблемы
```
❌ Проблемы монолитного кода

🍝 Спагетти-код — все связано со всем
🧪 Невозможно тестировать изолированно
🐛 Изменение одного ломает другое
👥 Новички не разбираются месяцами
🔥 Hotfix превращается в катастрофу
📈 Техдолг растет быстрее функций
```

### Слайд 5: Антипаттерн в коде
```javascript
// ❌ Все в одном файле — 200 строк хаоса
app.post('/api/news', async (req, res) => {
  // Валидация
  if (!req.body.url) return res.status(400)...
  
  // RSS парсинг
  const feed = await parser.parseURL(req.body.url);
  
  // Сохранение в БД
  const article = await db.query('INSERT...');
  
  // Уведомления
  await sendWebSocket(article);
  await sendPush(article);
  
  // Кэш
  await redis.del('news:*');
  
  res.json(article);
});
```

### Слайд 6: Требования Enterprise
```
🎯 Enterprise требования

✅ Изоляция компонентов
✅ Тестируемость каждого слоя
✅ Безопасные изменения
✅ Быстрое onboarding
✅ Горизонтальное масштабирование
✅ Мониторинг и алерты
✅ Graceful degradation

Нужна архитектура! 🏗️
```

---

## 🏛️ Блок 2: Domain-Driven Design (слайды 7-12)

### Слайд 7: Что такое DDD
```
Domain-Driven Design

🧠 Подход к проектированию сложных систем
📐 Моделирование предметной области
🗣️ Единый язык команды и кода
🏛️ Архитектурные паттерны

Не просто папки — философия разработки!
```

### Слайд 8: Четыре принципа DDD
```
🗣️ Ubiquitous Language
   Единый язык команды

🏛️ Bounded Context  
   Границы ответственности

📐 Domain Model
   Модель предметной области

🏗️ Layered Architecture
   Слоистая архитектура
```

### Слайд 9: Ubiquitous Language
```typescript
// ✅ Язык предметной области в коде
class NewsArticle {
  publish() ✅        // не createRecord() ❌
  archive() ✅        // не softDelete() ❌  
  cluster() ✅        // не group() ❌
}

// Команда говорит: "Опубликовать статью"
// Код делает: article.publish()

Код = живая документация! 📚
```

### Слайд 10: Bounded Context
```
🏛️ Четкие границы контекстов

News Context          Weather Context
┌─────────────────┐  ┌─────────────────┐
│ • Articles      │  │ • Forecasts     │
│ • Sources       │  │ • Locations     │
│ • Clusters      │  │ • Alerts        │
│ • Reactions     │  │ • Conditions    │
└─────────────────┘  └─────────────────┘

Каждый контекст — отдельная команда
```

### Слайд 11: Четыре слоя архитектуры
```
🏗️ Layered Architecture

┌─────────────────────────────────────────┐
│           API Layer                     │  HTTP, валидация
│  /api/news, /api/admin, /api/weather    │  WebSocket, роуты
└─────────────────────────────────────────┘
              ↓ зависит от
┌─────────────────────────────────────────┐
│       Application Layer                 │  Use Cases
│  CollectNewsUseCase, ClusterNewsUseCase │  Оркестрация
└─────────────────────────────────────────┘
              ↓ зависит от
┌─────────────────────────────────────────┐
│      Infrastructure Layer               │  Внешние системы
│  PostgreSQL, Redis, NER, RSS парсер     │  Кэш, БД, API
└─────────────────────────────────────────┘
              ↓ зависит от
┌─────────────────────────────────────────┐
│         Domain Layer                    │  Бизнес-логика
│  NewsArticle, NewsCluster, правила      │  Чистые функции
└─────────────────────────────────────────┘
```

### Слайд 12: Правило зависимостей
```
🎯 Главное правило DDD

Domain Layer НЕ ЗНАЕТ о других слоях!

❌ Domain импортирует Infrastructure
❌ Domain знает о HTTP или БД
❌ Domain зависит от фреймворков

✅ Чистая бизнес-логика
✅ Легко тестировать
✅ Переносимость между проектами
```

---

## 🔄 Блок 3: EventBus (слайды 13-16)

### Слайд 13: Проблема сильной связанности
```
❌ Антипаттерн: Прямые вызовы

CollectNewsUseCase
       │
       ├─→ CacheService.invalidate()
       ├─→ WebSocketManager.broadcast()
       ├─→ PushService.sendToAll()
       ├─→ ClusterService.updateClusters()
       └─→ AlertManager.checkThresholds()

Проблемы:
• Знает о всех потребителях
• Сложно добавить новые обработчики
• Невозможно тестировать изолированно
```

### Слайд 14: EventBus решение
```
✅ EventBus: Слабая связанность

Publisher              EventBus              Subscribers
┌─────────────────┐   ┌─────────┐   ┌─────────────────────┐
│CollectNewsUseCase│──→│ events  │──→│ CacheService        │
│                 │   │         │   │ WebSocketManager    │
│ emit('articles. │   │ routing │   │ PushService         │
│ collected', data)│   │         │   │ ClusterService      │
└─────────────────┘   └─────────┘   │ AlertManager        │
                                    └─────────────────────┘

Publisher не знает о Subscribers!
```

### Слайд 15: Преимущества EventBus
```
✅ Преимущества слабой связанности

🔌 Легко добавлять новые обработчики
🧪 Простое тестирование (mock EventBus)
📈 Горизонтальное масштабирование
🔄 Нет циклических зависимостей
⚡ Асинхронная обработка
🛡️ Изоляция ошибок
```

### Слайд 16: EventBus в коде
```typescript
// Издатель просто публикует событие
this.eventBus.emit('articles.collected', {
  insertedCount: 15,
  duration: 2500,
  timestamp: new Date()
});

// Подписчики регистрируются независимо
eventBus.subscribe('articles.collected', async (data) => {
  await cacheService.invalidate(['news']);
});

eventBus.subscribe('articles.collected', async (data) => {
  if (data.insertedCount >= 5) {
    await pushService.broadcast('New articles!');
  }
});
```

---

## 💻 Блок 4: Технологический стек (слайды 17-22)

### Слайд 17: Обзор стека
```
🛠️ Технологический стек

Frontend                Backend
┌─────────────────┐    ┌─────────────────┐
│ React 18.3.1    │    │ Node.js 20      │
│ TypeScript 5.6  │    │ Express 4.21    │
│ Vite 6.3.5      │    │ PostgreSQL 17   │
│ Zustand         │    │ Redis 7         │
│ Wouter          │    │ Drizzle ORM     │
└─────────────────┘    └─────────────────┘

        AI Services
    ┌─────────────────┐
    │ FastAPI + Python│
    │ Natasha NER     │
    │ pymorphy2       │
    └─────────────────┘
```

### Слайд 18: Почему React
```
⚛️ React 18.3.1 + TypeScript 5.6.3

✅ Зрелая экосистема
✅ Отличная TypeScript поддержка
✅ Concurrent Features для производительности
✅ Большое сообщество
✅ Богатая библиотека компонентов

🚀 Vite 6.3.5 вместо CRA:
• ⚡ Мгновенный HMR
• 📦 Оптимизированная сборка
• 🔧 Простая конфигурация
```

### Слайд 19: Почему Node.js
```
🟢 Node.js 20 + Express.js 4.21.2

✅ Высокая производительность для I/O
✅ Единый язык с фронтендом
✅ Отличная поддержка WebSocket
✅ Богатая экосистема npm
✅ Простое горизонтальное масштабирование

TypeScript везде = меньше ошибок! 🛡️
```

### Слайд 20: Почему PostgreSQL
```
🐘 PostgreSQL 17 + Drizzle ORM

✅ Полнотекстовый поиск (GIN индексы)
✅ JSONB для гибких данных
✅ ACID транзакции
✅ Отличная производительность
✅ Богатые типы данных

🔍 Поиск по 50,000+ статей за 50ms!
```

### Слайд 21: Почему Redis
```
🔴 Redis 7 для кэширования

✅ In-memory скорость
✅ Тегированная инвалидация
✅ Pub/Sub для кластера
✅ Graceful degradation (fallback на memory)

⚡ Hit rate > 80% = быстрая лента!
```

### Слайд 22: Почему отдельный AI сервис
```
🐍 FastAPI + Python для NER

✅ Python лучше для ML
✅ Независимое масштабирование
✅ Изоляция ошибок
✅ Graceful degradation

🧠 Natasha NER + pymorphy2:
• Извлечение сущностей (PER, ORG, LOC)
• Морфологическая нормализация
• Кластеризация похожих новостей
```

---

## 🔍 Блок 5: Практический код (слайды 23-26)

### Слайд 23: Domain Layer пример
```typescript
// ✅ Чистая бизнес-логика
export class NewsArticle {
  canBeArchived(): boolean {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    return this.publishedAt < fourteenDaysAgo;
  }

  canBeClustered(): boolean {
    return this.content.length > 100 && !this.clusterId;
  }
}

// Никаких внешних зависимостей!
// Легко тестировать!
```

### Слайд 24: Use Case пример
```typescript
// ✅ Оркестрация без деталей
export class CollectNewsUseCase {
  async execute(): Promise<CollectionResult> {
    // 1. Получаем источники
    const sources = await this.sourceRepository.getActive();
    
    // 2. Собираем статьи
    const articles = await this.rssParser.parseMany(sources);
    
    // 3. Сохраняем
    const result = await this.articleRepository.saveMany(articles);
    
    // 4. Уведомляем
    this.eventBus.emit('articles.collected', result);
    
    return result;
  }
}
```

### Слайд 25: Event Subscribers
```typescript
// ✅ Независимые подписчики
eventBus.subscribe('articles.collected', async (data) => {
  await cacheService.invalidate(['news']);
});

eventBus.subscribe('articles.collected', async (data) => {
  await webSocket.broadcast('news_updated');
});

eventBus.subscribe('articles.collected', async (data) => {
  if (data.count >= 5) {
    await pushService.notify('New articles!');
  }
});

// Каждый подписчик независим!
```

### Слайд 26: Структура проекта
```
server/
├── api/                    # API Layer
│   ├── news/
│   ├── admin/
│   └── weather/
├── application/            # Application Layer
│   ├── news/
│   └── weather/
├── domain/                 # Domain Layer
│   ├── news/
│   └── weather/
└── infrastructure/         # Infrastructure Layer
    ├── database/
    ├── cache/
    └── events/
```

---

## 🎓 Заключение (слайды 27-30)

### Слайд 27: Архитектурные принципы
```
🎯 Ключевые принципы

1️⃣ DDD слои — четкое разделение ответственности
2️⃣ EventBus — слабая связанность через события
3️⃣ Технологический стек — каждое решение обосновано
4️⃣ Тестируемость — изолированные компоненты
```

### Слайд 28: Преимущества архитектуры
```
✅ Что получили

🚀 Легко добавлять новые функции
🧪 Простое тестирование компонентов
📈 Горизонтальное масштабирование
👥 Быстрое onboarding новых разработчиков
🛡️ Изоляция ошибок
⚡ Высокая производительность
```

### Слайд 29: Метрики успеха
```
📊 Результаты архитектуры

• 4 слоя архитектуры
• 12 событий в EventBus
• 50+ Use Cases
• 0 циклических зависимостей
• ~60% test coverage
• < 200ms API latency
• 99.9% uptime
```

### Слайд 30: Анонс следующего эпизода
```
🎬 Следующий эпизод

"Backend: RSS сбор и обработка"

🔍 Как система каждую минуту собирает новости
⚡ Обработка 15+ источников параллельно
🛡️ Graceful degradation при ошибках
📊 Мониторинг и алерты в реальном времени

Подписывайтесь! 👍
```

---

## 🎨 Дизайн-система слайдов

### Цветовая схема
- **API Layer:** `#3b82f6` (синий)
- **Application Layer:** `#10b981` (зеленый)
- **Infrastructure Layer:** `#f59e0b` (оранжевый)
- **Domain Layer:** `#8b5cf6` (фиолетовый)
- **Акценты:** `#ef4444` (красный для проблем), `#22c55e` (зеленый для решений)

### Типографика
- **Заголовки:** Inter Bold, 32px
- **Подзаголовки:** Inter SemiBold, 24px
- **Текст:** Inter Regular, 18px
- **Код:** JetBrains Mono, 16px

### Иконки и элементы
- **Эмодзи** для быстрого восприятия
- **Стрелки** для показа зависимостей
- **Цветные блоки** для группировки
- **Галочки/крестики** для проблем/решений

### Анимации
- **Fade in** для появления элементов
- **Slide from left** для списков
- **Highlight** для важных моментов
- **Code typing** для примеров кода

---

## 📱 Адаптация для разных форматов

### YouTube (16:9)
- Основной формат презентации
- Крупный шрифт для мобильных устройств
- Контрастные цвета

### Shorts/Reels (9:16)
- Вертикальные тизеры ключевых моментов
- Один концепт на слайд
- Крупные эмодзи и короткий текст

### Статьи (Habr)
- Статичные версии диаграмм
- Подробные описания под каждой схемой
- Ссылки на GitHub код

---

*Эта презентация обеспечит визуальную поддержку всех архитектурных концепций и поможет зрителям лучше понять сложные технические решения.*