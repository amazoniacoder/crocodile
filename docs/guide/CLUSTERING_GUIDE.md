# Clustering Guide — Токенная кластеризация

> Версия: 1.0  
> Создан: Май 2025

---

## Концепция

Автоматическая группировка похожих новостей из разных источников на основе схожести заголовков. Используется морфологическая нормализация через NER-сервис для повышения точности.

**Цель:** объединить статьи об одном событии от разных СМИ.

**Пример:**
```
Lenta.ru:  "Трамп подписал указ о санкциях против России"
RBC:       "Указ о санкциях подписан Трампом"
ТАСС:      "Президент США подписал указ о новых санкциях"
→ Один кластер
```

---

## Алгоритм

### Шаг 1: Выборка статей

```sql
SELECT * FROM news_articles
WHERE cluster_id IS NULL
  AND published_at >= NOW() - INTERVAL '7 days'
ORDER BY published_at DESC;
```

**Окно:** 7 дней (настраивается в `ClusterNewsUseCase.ts`)

### Шаг 2: Бакеты region:category

```typescript
const buckets = new Map<string, NewsArticle[]>();

for (const article of articles) {
  const key = `${article.region}:${article.category}`;
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key)!.push(article);
}
```

**Причина:** статьи из разных регионов/категорий не кластеризуются.

**Пример бакетов:**
- `russia:tech` — 150 статей
- `russia:economy` — 200 статей
- `world:politics` — 180 статей

### Шаг 3: Нормализация заголовков

```typescript
// Батч всех заголовков бакета
const titles = bucket.map(a => a.title);
const normalized = await nerService.normalizeTexts(titles);

// Результат: Map<articleId, normalizedTokens>
```

**NER-сервис (`POST /normalize`):**
```python
# ner-service/main.py
def normalize_text(text: str) -> List[str]:
    doc = NamesExtractor(text)
    tokens = []
    for token in doc.tokens:
        if token.pos in ['NOUN', 'VERB', 'ADJ']:
            # Приведение к именительному падежу
            normal_form = morph.parse(token.text)[0].normal_form
            tokens.append(normal_form)
    return tokens
```

**Пример:**
```
"Трамп подписал указ о санкциях против России"
→ ["трамп", "подписать", "указ", "санкция", "россия"]

"Указ о санкциях подписан Трампом"
→ ["указ", "санкция", "подписать", "трамп"]
```

### Шаг 4: Сравнение заголовков

```typescript
function areSimilarNormalized(
  tokens1: string[],
  tokens2: string[],
  threshold: number = 0.6
): boolean {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  const similarity = intersection.size / union.size; // Jaccard similarity
  return similarity >= threshold;
}
```

**Jaccard similarity:**
```
J(A, B) = |A ∩ B| / |A ∪ B|
```

**Пример:**
```
A = ["трамп", "подписать", "указ", "санкция", "россия"]
B = ["указ", "санкция", "подписать", "трамп"]

Intersection: ["трамп", "подписать", "указ", "санкция"] = 4
Union: ["трамп", "подписать", "указ", "санкция", "россия"] = 5

Similarity: 4 / 5 = 0.8 ≥ 0.6 → Похожи
```

### Шаг 5: Группировка

```typescript
const groups: NewsArticle[][] = [];

for (const article of bucket) {
  let addedToGroup = false;
  
  for (const group of groups) {
    // Сравнить с первой статьёй группы
    if (areSimilarNormalized(
      normalizedMap.get(article.id),
      normalizedMap.get(group[0].id),
      0.6
    )) {
      group.push(article);
      addedToGroup = true;
      break;
    }
  }
  
  if (!addedToGroup) {
    groups.push([article]);
  }
}
```

**Особенность:** сравнение только с первой статьёй группы (эталон).

### Шаг 6: Сохранение кластеров

```typescript
for (const group of groups) {
  if (group.length < 2) continue; // Группы из 1 статьи не сохраняются
  
  const cluster = await db.insert(newsClusters).values({
    title: group[0].title,
    articleCount: group.length,
    region: group[0].region,
    category: group[0].category,
    firstSeenAt: group[0].publishedAt,
    lastSeenAt: group[group.length - 1].publishedAt
  }).returning();
  
  await db.update(newsArticles)
    .set({ clusterId: cluster.id })
    .where(inArray(newsArticles.id, group.map(a => a.id)));
}
```

---

## Деградация при недоступности NER

### Fallback на сырые токены

```typescript
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\wа-яё\s]/gi, ' ')
    .split(/\s+/)
    .filter(t => t.length > 3);
}

function areSimilar(title1: string, title2: string): boolean {
  const tokens1 = tokenize(title1);
  const tokens2 = tokenize(title2);
  return areSimilarNormalized(tokens1, tokens2, 0.6);
}
```

**Проблема:** не учитываются падежи.

**Пример:**
```
"Трамп подписал указ"
→ ["трамп", "подписал", "указ"]

"Указ подписан Трампом"
→ ["указ", "подписан", "трампом"]

Intersection: ["указ"] = 1
Union: ["трамп", "подписал", "указ", "подписан", "трампом"] = 5
Similarity: 1 / 5 = 0.2 < 0.6 → Не похожи
```

**С нормализацией:**
```
"Трамп подписал указ"
→ ["трамп", "подписать", "указ"]

"Указ подписан Трампом"
→ ["указ", "подписать", "трамп"]

Intersection: ["трамп", "подписать", "указ"] = 3
Union: ["трамп", "подписать", "указ"] = 3
Similarity: 3 / 3 = 1.0 ≥ 0.6 → Похожи
```

---

## Настройка качества

### Порог схожести

```typescript
// server/domain/news/NewsCluster.ts
const SIMILARITY_THRESHOLD = 0.6;
```

**Влияние:**
- 0.5 — больше кластеров, ниже точность (ложные срабатывания)
- 0.7 — меньше кластеров, выше точность (пропуски похожих)
- 0.6 — оптимальный баланс

**Тестирование:**
```bash
npm run test -- NewsCluster.test.ts
```

### Окно кластеризации

```typescript
// server/application/news/ClusterNewsUseCase.ts
const CLUSTERING_WINDOW_DAYS = 7;
```

**Влияние:**
- 3 дня — быстрее, но пропускаются долгоиграющие темы
- 14 дней — медленнее, но лучше для долгих тем (санкции, курс валют)
- 7 дней — оптимально для новостного агрегатора

### Минимальный размер группы

```typescript
if (group.length < 2) continue;
```

**Причина:** группы из 1 статьи не имеют смысла.

---

## Примеры кластеризации

### Пример 1: Политика

**Статьи:**
```
1. Lenta.ru:  "Путин провёл встречу с главами регионов"
2. RBC:       "Встреча Путина с губернаторами состоялась в Кремле"
3. ТАСС:      "Президент встретился с руководителями субъектов РФ"
```

**Нормализация:**
```
1. ["путин", "провести", "встреча", "глава", "регион"]
2. ["встреча", "путин", "губернатор", "состояться", "кремль"]
3. ["президент", "встретиться", "руководитель", "субъект"]
```

**Сравнение 1-2:**
```
Intersection: ["путин", "встреча"] = 2
Union: ["путин", "провести", "встреча", "глава", "регион", "губернатор", "состояться", "кремль"] = 8
Similarity: 2 / 8 = 0.25 < 0.6 → Не похожи
```

**Проблема:** разные слова для одного понятия (глава/губернатор, регион/субъект).

**Решение:** Entity-Driven Cluster (см. [NER_SERVICE_GUIDE.md](./NER_SERVICE_GUIDE.md)).

### Пример 2: Экономика

**Статьи:**
```
1. RBC:       "Курс доллара вырос до 95 рублей"
2. Lenta.ru:  "Доллар подорожал до 95 рублей на Мосбирже"
3. ТАСС:      "Рубль ослаб до 95 за доллар"
```

**Нормализация:**
```
1. ["курс", "доллар", "вырасти", "рубль"]
2. ["доллар", "подорожать", "рубль", "мосбиржа"]
3. ["рубль", "ослабнуть", "доллар"]
```

**Сравнение 1-2:**
```
Intersection: ["доллар", "рубль"] = 2
Union: ["курс", "доллар", "вырасти", "рубль", "подорожать", "мосбиржа"] = 6
Similarity: 2 / 6 = 0.33 < 0.6 → Не похожи
```

**Сравнение 1-3:**
```
Intersection: ["доллар", "рубль"] = 2
Union: ["курс", "доллар", "вырасти", "рубль", "ослабнуть"] = 5
Similarity: 2 / 5 = 0.4 < 0.6 → Не похожи
```

**Проблема:** разные глаголы (вырасти/подорожать/ослабнуть).

### Пример 3: Технологии

**Статьи:**
```
1. Habr:      "OpenAI выпустила новую версию GPT-5"
2. Lenta.ru:  "OpenAI представила GPT-5 с улучшенными возможностями"
3. RBC:       "Новая модель GPT-5 от OpenAI доступна разработчикам"
```

**Нормализация:**
```
1. ["openai", "выпустить", "новый", "версия", "gpt"]
2. ["openai", "представить", "gpt", "улучшенный", "возможность"]
3. ["новый", "модель", "gpt", "openai", "доступный", "разработчик"]
```

**Сравнение 1-2:**
```
Intersection: ["openai", "gpt", "новый"] = 3
Union: ["openai", "выпустить", "новый", "версия", "gpt", "представить", "улучшенный", "возможность"] = 8
Similarity: 3 / 8 = 0.375 < 0.6 → Не похожи
```

**Сравнение 1-3:**
```
Intersection: ["openai", "новый", "gpt"] = 3
Union: ["openai", "выпустить", "новый", "версия", "gpt", "модель", "доступный", "разработчик"] = 8
Similarity: 3 / 8 = 0.375 < 0.6 → Не похожи
```

**Проблема:** порог 0.6 слишком высокий для коротких заголовков.

**Решение:** снизить порог до 0.5 или использовать Entity-Driven Cluster.

---

## Известные ограничения

### 1. Синонимы

**Проблема:**
```
"Путин провёл встречу" vs "Президент провёл встречу"
→ Не кластеризуются (разные слова)
```

**Решение:** Entity-Driven Cluster распознаёт "Путин" и "Президент" как одну сущность.

### 2. Короткие заголовки

**Проблема:**
```
"Курс доллара вырос" vs "Доллар подорожал"
→ Intersection: ["доллар"] = 1
→ Union: ["курс", "доллар", "вырасти", "подорожать"] = 4
→ Similarity: 0.25 < 0.6
```

**Решение:** снизить порог до 0.5 или использовать Entity-Driven Cluster.

### 3. Разные события с одинаковыми словами

**Проблема:**
```
"Трамп подписал указ о санкциях" vs "Трамп подписал указ о налогах"
→ Similarity: 0.8 ≥ 0.6 → Кластеризуются (ошибка)
```

**Решение:** Entity-Driven Cluster учитывает контекст (санкции vs налоги).

### 4. Английские заголовки

**Проблема:**
Natasha не работает с английским → нормализация не срабатывает.

**Решение:** fallback на сырые токены (работает, но хуже).

---

## Метрики качества

### Precision (точность)

```
Precision = True Positives / (True Positives + False Positives)
```

**True Positive:** статьи об одном событии кластеризованы.
**False Positive:** статьи о разных событиях кластеризованы.

**Целевое значение:** > 90%

### Recall (полнота)

```
Recall = True Positives / (True Positives + False Negatives)
```

**True Positive:** статьи об одном событии кластеризованы.
**False Negative:** статьи об одном событии не кластеризованы.

**Целевое значение:** > 70%

### F1-Score

```
F1 = 2 * (Precision * Recall) / (Precision + Recall)
```

**Целевое значение:** > 0.8

### Тестирование

```bash
npm run test -- NewsCluster.test.ts
```

**Тесты:**
- `areSimilarNormalized` — 21 тест
- Примеры из реальных новостей
- Граничные случаи (короткие заголовки, синонимы)

---

## Сравнение с Entity-Driven Cluster

| Критерий | Токенная кластеризация | Entity-Driven Cluster |
|----------|------------------------|----------------------|
| **Скорость** | Быстро (O(n²) в бакете) | Медленно (SQL ILIKE) |
| **Точность** | 70-80% | 85-95% |
| **Синонимы** | Не учитывает | Учитывает (Путин = Президент) |
| **Короткие заголовки** | Плохо | Хорошо |
| **Английский** | Fallback на сырые токены | Не работает (Natasha) |
| **Использование** | Автоматическая группировка | «Похожие новости» на детальной странице |

**Рекомендация:** использовать оба подхода:
- Токенная кластеризация — для автоматической группировки в ленте
- Entity-Driven Cluster — для блока «Похожие новости»

---

## Потенциальные улучшения

### 1. TF-IDF вместо Jaccard

```typescript
// Взвешивание редких слов
const idf = Math.log(totalDocuments / documentsWithTerm);
const tfidf = termFrequency * idf;
```

**Преимущество:** редкие слова (названия, имена) важнее частых (и, в, на).

### 2. Word2Vec / BERT embeddings

```typescript
// Семантическая близость
const embedding1 = model.encode(title1);
const embedding2 = model.encode(title2);
const similarity = cosineSimilarity(embedding1, embedding2);
```

**Преимущество:** учитывает семантику (Путин ≈ Президент).

**Недостаток:** требует ML-модель, медленнее.

### 3. Кластеризация по времени

```typescript
// Группировать статьи, опубликованные в течение 1 часа
const timeWindow = 3600; // секунды
```

**Преимущество:** события происходят одновременно → выше вероятность связи.

### 4. Учёт источника

```typescript
// Статьи из одного источника не кластеризуются
if (article1.sourceId === article2.sourceId) continue;
```

**Преимущество:** избежать дублей от одного СМИ.

---

## Запуск кластеризации

### Автоматически

```typescript
// server/application/news/subscribers.ts
eventBus.on('articles.collected', async () => {
  await clusterNewsUseCase.execute();
});
```

Срабатывает после каждого цикла сбора.

### Вручную

```bash
curl -X POST http://localhost:5000/api/admin/jobs/cluster \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Проверка результатов

```sql
-- Статьи с кластерами
SELECT COUNT(*) FROM news_articles WHERE cluster_id IS NOT NULL;

-- Кластеры
SELECT * FROM news_clusters ORDER BY article_count DESC LIMIT 10;

-- Статьи кластера
SELECT a.title, a.published_at, s.name AS source
FROM news_articles a
LEFT JOIN news_sources s ON a.source_id = s.id
WHERE a.cluster_id = 123
ORDER BY a.published_at;
```

---

> См. также: [NER_SERVICE_GUIDE.md](./NER_SERVICE_GUIDE.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [DATA_FLOW.md](./diagrams/DATA_FLOW.md)
