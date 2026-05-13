# Подготовка к записи Эпизода 4: "Frontend: React + TypeScript"

---

## 📋 Файлы для демонстрации

```
client/src/
├── App.tsx                          ← Блок 1: провайдеры и роутинг
├── hooks/useNewsFeed.ts             ← Блок 2: жизненный цикл ленты
├── components/news/
│   ├── NewsFeed.tsx                 ← Блок 3: виртуализация
│   └── NewsCard.tsx                 ← Блок 5: три типа контента
├── store/
│   ├── newsRegionStore.ts           ← Блок 4: Zustand
│   └── newsNotificationsStore.ts
└── ui-system/
    ├── tokens/colors.css            ← Блок 6: токены
    └── themes/dark.css              ← Блок 6: тёмная тема
```

### Порядок открытия в VS Code
1. `App.tsx` — показать дерево провайдеров и Switch
2. `useNewsFeed.ts` — показать IDB preload, fetchNews, acceptPending
3. `NewsFeed.tsx` — показать useVirtualizer и бесконечную прокрутку
4. `NewsCard.tsx` — показать три ветки sourceType
5. `newsRegionStore.ts` — показать минимальный Zustand store
6. `ui-system/tokens/colors.css` + `themes/dark.css`

---

## 🎬 Демо в браузере

### Подготовить перед записью
- [ ] Запустить приложение: `npm run dev`
- [ ] Наполнить БД: минимум 200 статей разных типов (RSS, Telegram, YouTube)
- [ ] Открыть DevTools → Performance (для демо 60fps)
- [ ] Открыть DevTools → Elements (для демо виртуализации)

### Сценарии демонстрации

**Виртуализация:**
1. Открыть DevTools → Elements
2. Прокрутить ленту — показать что в DOM только ~15 карточек
3. DevTools → Performance → Record → прокрутить → Stop → показать 60fps

**Pending articles:**
1. Запустить сбор вручную:
   ```bash
   curl -X POST http://localhost:5000/api/admin/jobs/collect \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"group": "fast"}'
   ```
2. Показать тост с количеством новых статей
3. Кликнуть → показать staggered анимацию

**Тёмная тема:**
1. Кликнуть переключатель темы в хедере
2. Показать плавный переход через CSS-переменные

**Синхронизация URL:**
1. Выбрать фильтры (регион + категория)
2. Показать изменение URL
3. Скопировать URL → открыть в новой вкладке → те же фильтры

**Offline режим:**
1. DevTools → Network → Offline
2. Обновить страницу → показать кэшированные статьи
3. Показать баннер "Офлайн режим"

---

## ⚙️ Настройки VS Code для записи

```json
{
  "editor.fontSize": 16,
  "editor.fontFamily": "JetBrains Mono",
  "editor.minimap.enabled": false,
  "breadcrumbs.enabled": false,
  "editor.wordWrap": "on",
  "workbench.colorTheme": "Dark+ (default dark)"
}
```

---

## 🎯 Ключевые акценты

1. **useNewsFeed** — не просто fetch, а полный цикл: IDB preload → сеть → WebSocket → pending → offline
2. **Виртуализация** — показать в DevTools Elements что в DOM только ~15 карточек
3. **Pending articles** — объяснить почему не вставляем сразу (UX: пользователь не теряет позицию)
4. **Zustand** — сравнить с Redux: 5 строк vs 50 строк boilerplate
5. **CSS-токены** — показать как тёмная тема работает через переопределение переменных

---

## 📊 Метрики для слайдов

```
Без виртуализации:  7,500 DOM-узлов, 2-3с рендер, 10-15fps
С виртуализацией:   ~225 DOM-узлов, <100ms рендер, 60fps

Wouter: 2KB
React Router v6: ~50KB

Zustand store: 5 строк
Redux store: ~50 строк boilerplate
```

---

*Подготовка обеспечит точное соответствие демонстрации реальному коду.*
