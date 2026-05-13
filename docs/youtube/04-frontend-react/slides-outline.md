# Слайды для Эпизода 4: "Frontend: React + TypeScript"

> **Презентация:** 20-22 слайда для 22-25 минут эпизода

---

### Слайд 1: Заставка
```
NewsAggregator — Frontend Deep Dive
Эпизод 4: "React + TypeScript"

⚛️ Виртуализированная лента — 500 статей без тормозов
🔄 useNewsFeed — сеть, IDB, WebSocket в одном хуке
🗃️ Zustand — состояние без Redux boilerplate
🌐 Wouter — роутинг с синхронизацией URL
🎨 UI-система — BEM, CSS-токены, тёмная тема
```

### Слайд 2: План эпизода
```
1️⃣ Структура приложения — провайдеры и роутинг
2️⃣ useNewsFeed — жизненный цикл ленты
3️⃣ Виртуализация — @tanstack/react-virtual
4️⃣ Zustand — управление состоянием
5️⃣ NewsCard — три типа контента
6️⃣ UI-система — BEM + токены + темы
```

---

## Блок 1: Структура (слайды 3-4)

### Слайд 3: Провайдеры
```
App
└── ThemeProvider
    └── WebSocketProvider  ← real-time для всего приложения
        └── NotificationProvider
            └── AppInner
                ├── /admin → AdminMonitorPage (lazy)
                └── /* → Layout → Switch (роуты)

Каждый провайдер — одна ответственность
AdminMonitorPage — lazy, не грузится при обычном посещении
```

### Слайд 4: Wouter vs React Router
```
React Router v6:    Wouter:
~50KB               ~2KB (в 25 раз легче!)
useNavigate         useLocation
useParams           params через Route callback
Outlet              Switch/Route
Link                Link (тот же API)

Достаточно для SPA без SSR
```

---

## Блок 2: useNewsFeed (слайды 5-8)

### Слайд 5: Три источника данных
```
1. Сеть (fetch /api/news)
   └─ OK → setArticles() + saveFeedSlice(IDB)
   └─ Error → fallback на IDB

2. IndexedDB (Dexie.js)
   └─ Preload при маунте (показываем сразу)
   └─ Offline fallback при ошибке сети

3. WebSocket (real-time)
   └─ lastMessage → fetchNews(markNew=true)
   └─ Новые статьи → pendingArticles
```

### Слайд 6: Паттерн Pending Articles
```
❌ Плохо: вставить новые статьи сразу
   → пользователь теряет позицию в ленте

✅ Хорошо: накапливать в pending
   → тост "15 новых статей ↑"
   → пользователь сам решает когда принять
   → acceptPending() → staggered анимация
```

### Слайд 7: Staggered анимация
```typescript
// Каждая карточка появляется с задержкой
const delay = Math.min(newIndex * 200, 1600) + 2000;
// card[0]: 2000ms
// card[1]: 2200ms
// card[8+]: 3600ms (cap)

// Фаза skeleton → content
const [phase, setPhase] = useState(isNew ? 'skeleton' : 'content');
setTimeout(() => setPhase('content'), delay);
```

### Слайд 8: PWA Badge
```typescript
// Счётчик непрочитанных на иконке приложения
useEffect(() => {
  if (!('setAppBadge' in navigator)) return;
  if (unreadCount > 0) navigator.setAppBadge(unreadCount);
  else navigator.clearAppBadge();
}, [unreadCount]);

// Работает в Chrome, Edge, Safari (iOS 16.4+)
```

---

## Блок 3: Виртуализация (слайды 9-11)

### Слайд 9: Проблема
```
500 статей без виртуализации:
  DOM-узлов: 500 × 15 = 7,500
  Высота: 500 × 176px = 88,000px
  Первый рендер: 2-3 секунды
  Скролл: 10-15 fps ❌
```

### Слайд 10: Решение — useVirtualizer
```typescript
const virtualizer = useVirtualizer({
  count: articles.length,
  getScrollElement: () => listRef.current,
  estimateSize: () => 176,
  overscan: 6,
  measureElement: (el) => {
    // Реальная высота с margin
    const s = getComputedStyle(el);
    return el.getBoundingClientRect().height
      + parseFloat(s.marginTop)
      + parseFloat(s.marginBottom);
  },
});
```

### Слайд 11: Результат
```
С виртуализацией:
  DOM-узлов: ~15 (видимые + overscan)
  Первый рендер: < 100ms ✅
  Скролл: 60 fps ✅
  Память: стабильная ✅

Ключевой трюк:
  transform: translateY(${item.start}px)
  ← позиционирование без reflow
```

---

## Блок 4: Zustand (слайды 12-13)

### Слайд 12: Минимальный store
```typescript
// Весь store — 5 строк
export const useNewsRegionStore = create<NewsRegionStore>((set) => ({
  region: 'all',
  setRegion: (region) => set({ region }),
}));

// Использование — без connect, без dispatch
const { region, setRegion } = useNewsRegionStore();
```

### Слайд 13: Синхронизация с URL
```
Фильтры хранятся в URL:
/russia?category=tech&city=Москва

✅ Отфильтрованной лентой можно поделиться
✅ Браузер "назад" работает корректно
✅ SEO-friendly (для публичных страниц)
```

---

## Блок 5: NewsCard (слайды 14-16)

### Слайд 14: Три типа контента
```
sourceType: 'rss'
  → Link /news/:id-:slug
  → ArticleReactions (лайки/эмодзи)

sourceType: 'telegram'
  → Badge Telegram (синий)
  → Кнопка "Открыть пост" → Modal + TelegramEmbed

sourceType: 'youtube'
  → Badge YouTube (красный)
  → Thumbnail из ytimg.com
  → Кнопка "Смотреть видео" → YouTubeEmbed inline
```

### Слайд 15: Подсветка поиска
```typescript
// Подсветка совпадений в заголовке
const highlightText = (text: string, query?: string) => {
  const regex = new RegExp(`(${escapeRegExp(query)})`, 'ig');
  return text.split(regex).map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="news-card__highlight">{part}</mark>
      : part
  );
};
```

### Слайд 16: Относительное время
```typescript
// Обновляется каждую минуту без перерендера ленты
const useRelativeTime = (iso: string) => {
  const [label, setLabel] = useState(() => formatTime(iso));
  useEffect(() => {
    const id = setInterval(() => setLabel(formatTime(iso)), 60000);
    return () => clearInterval(id);
  }, [iso]);
  return label; // "5 мин назад" → "6 мин назад" → "2 ч назад"
};
```

---

## Блок 6: UI-система (слайды 17-19)

### Слайд 17: Структура
```
ui-system/
├── tokens/     ← CSS-переменные
├── themes/     ← light.css / dark.css
├── components/ ← button, modal, feedback...
└── patterns/   ← BEM page-level блоки
```

### Слайд 18: CSS-токены
```css
:root {
  --color-primary-500: #2563eb;
  --color-surface: #ffffff;
  --spacing-md: 16px;
  --radius-card: 8px;
}

[data-theme="dark"] {
  --color-surface: #0f172a;
  --color-text-primary: #f1f5f9;
}

/* Компоненты используют токены, не хардкод */
.news-card { background: var(--color-surface); }
```

### Слайд 19: BEM
```css
.news-card          { }  /* блок */
.news-card__title   { }  /* элемент */
.news-card--new     { }  /* модификатор */
.news-card--telegram{ }  /* модификатор */

Преимущества:
✅ Предсказуемые имена
✅ Нет конфликтов стилей
✅ Легко найти в коде
✅ Понятно без документации
```

---

## Заключение (слайды 20-21)

### Слайд 20: Ключевые решения
```
✅ Wouter — 2KB роутинг, URL как источник истины
✅ useNewsFeed — сеть + IDB + WebSocket в одном хуке
✅ @tanstack/react-virtual — 500 статей, 15 DOM-узлов
✅ Zustand — состояние без boilerplate
✅ Pending articles — пользователь контролирует обновление
✅ BEM + CSS-токены — предсказуемые стили
```

### Слайд 21: Анонс Эпизода 5
```
🎬 Эпизод 5: "AI интеграция: NER и кластеризация"

🧠 NER-сервис на FastAPI + Natasha
🔤 pymorphy2 — морфологическая нормализация
🔗 Entity-Driven кластеризация
📊 Как группируются похожие новости

Подписывайтесь! 👍
```

---

## 🎨 Дизайн-система

### Цветовая схема слайдов
- **React:** `#61dafb` (голубой)
- **TypeScript:** `#3178c6` (синий)
- **Zustand:** `#ff6b35` (оранжевый)
- **Wouter:** `#10b981` (зелёный)
- **Виртуализация:** `#8b5cf6` (фиолетовый)

---

*Слайды основаны на реальном production-коде проекта.*
