import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NewsArticleRepository } from '../infrastructure/persistence/NewsArticleRepository';

// --- db mock (hoisted) ---
const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }));

vi.mock('../db/db', () => ({
  db: { select: mockSelect },
  pool: { on: vi.fn() },
  checkDatabaseConnection: vi.fn().mockResolvedValue(true),
  logDatabaseConfig: vi.fn(),
}));

// Drizzle builder — chainable, resolves to `result` on await
function makeBuilder(result: unknown) {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  b.from = chain;
  b.where = chain;
  b.orderBy = chain;
  b.limit = chain;
  b.offset = chain;
  // Promise-like
  b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  b.catch = (reject: (e: unknown) => unknown) => Promise.resolve(result).catch(reject);
  return b;
}

// Article row factory
function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    sourceId: 10,
    title: 'Test title',
    description: null,
    imageUrl: null,
    url: 'https://example.com/1',
    publishedAt: new Date('2025-01-01T12:00:00Z'),
    fetchedAt: new Date('2025-01-01T12:01:00Z'),
    region: 'russia',
    category: 'tech',
    clusterId: null,
    isArchived: false,
    createdAt: new Date('2025-01-01T12:01:00Z'),
    likesCount: 0,
    dislikesCount: 0,
    entities: null,
    ...overrides,
  };
}

describe('NewsArticleRepository.findMany', () => {
  let repo: NewsArticleRepository;

  beforeEach(() => {
    repo = new NewsArticleRepository();
    vi.clearAllMocks();
  });

  // findMany calls Promise.all([rows, count]) — both use db.select()
  // odd calls → rows, even calls → count
  function setupFindMany(rows: unknown[], count: number) {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      return call % 2 === 1 ? makeBuilder(rows) : makeBuilder([{ count }]);
    });
  }

  it('возвращает статьи и total без фильтров', async () => {
    setupFindMany([makeRow()], 1);
    const result = await repo.findMany({}, 1, 20);
    expect(result.total).toBe(1);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].title).toBe('Test title');
  });

  it('фильтр по одной категории', async () => {
    setupFindMany([makeRow({ category: 'economy' })], 1);
    const result = await repo.findMany({ category: 'economy' }, 1, 20);
    expect(result.articles[0].category).toBe('economy');
  });

  it('фильтр по нескольким категориям (массив)', async () => {
    const rows = [makeRow({ category: 'tech' }), makeRow({ id: 2, category: 'economy' })];
    setupFindMany(rows, 2);
    const result = await repo.findMany({ category: ['tech', 'economy'] }, 1, 20);
    expect(result.total).toBe(2);
    expect(result.articles).toHaveLength(2);
  });

  it('category: "all" не применяет фильтр по категории', async () => {
    const rows = [makeRow({ category: 'tech' }), makeRow({ id: 2, category: 'politics' })];
    setupFindMany(rows, 2);
    const result = await repo.findMany({ category: 'all' }, 1, 20);
    expect(result.total).toBe(2);
  });

  it('enabledRussia=false — запрос выполняется, возвращает world-статьи', async () => {
    setupFindMany([makeRow({ region: 'world' })], 1);
    const result = await repo.findMany({ enabledRussia: false }, 1, 20);
    expect(result.articles[0].region).toBe('world');
  });

  it('пагинация: page=2, limit=10 возвращает корректный total', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => makeRow({ id: i + 11 }));
    setupFindMany(rows, 25);
    const result = await repo.findMany({}, 2, 10);
    expect(result.total).toBe(25);
    expect(result.articles).toHaveLength(10);
  });

  it('пустой результат возвращает total=0 и пустой массив', async () => {
    setupFindMany([], 0);
    const result = await repo.findMany({ region: 'world', category: 'tech' }, 1, 20);
    expect(result.total).toBe(0);
    expect(result.articles).toHaveLength(0);
  });

  it('фильтр по региону', async () => {
    setupFindMany([makeRow({ region: 'world' })], 1);
    const result = await repo.findMany({ region: 'world' }, 1, 20);
    expect(result.articles[0].region).toBe('world');
  });
});
