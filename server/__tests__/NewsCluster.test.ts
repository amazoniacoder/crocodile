import { describe, it, expect, vi } from 'vitest';
import { tokenize, titleSimilarity, areSimilar, tokenizeNormalized, areSimilarNormalized } from '../domain/news/NewsCluster';

describe('tokenize', () => {
  it('возвращает Set токенов в нижнем регистре', () => {
    const tokens = tokenize('Путин встретился с Байденом');
    expect(tokens).toBeInstanceOf(Set);
    expect(tokens.has('путин')).toBe(true);
    expect(tokens.has('байденом')).toBe(true);
  });

  it('фильтрует слова короче MIN_WORD_LENGTH (4)', () => {
    const tokens = tokenize('ЦБ РФ поднял ставку');
    expect(tokens.has('цб')).toBe(false);
    expect(tokens.has('рф')).toBe(false);
    expect(tokens.has('поднял')).toBe(true);
    expect(tokens.has('ставку')).toBe(true);
  });

  it('фильтрует стоп-слова', () => {
    const tokens = tokenize('Россия заявила после переговоров');
    expect(tokens.has('заявила')).toBe(false);
    expect(tokens.has('после')).toBe(false);
    expect(tokens.has('россия')).toBe(true);
  });

  it('удаляет пунктуацию', () => {
    const tokens = tokenize('Санкции, введённые против России!');
    expect(tokens.has('санкции')).toBe(true);
    expect(tokens.has('введённые')).toBe(true);
  });

  it('работает с английскими заголовками', () => {
    const tokens = tokenize('Russia said talks with Ukraine failed');
    expect(tokens.has('russia')).toBe(true);
    expect(tokens.has('ukraine')).toBe(true);
    expect(tokens.has('said')).toBe(false); // стоп-слово
    expect(tokens.has('with')).toBe(false); // стоп-слово
  });

  it('возвращает пустой Set для пустой строки', () => {
    expect(tokenize('').size).toBe(0);
  });

  it('возвращает пустой Set если все слова — стоп-слова', () => {
    expect(tokenize('said with from have').size).toBe(0);
  });
});

describe('titleSimilarity', () => {
  it('возвращает количество общих токенов', () => {
    const a = 'Россия ввела санкции против Европы';
    const b = 'Европа ответила санкции против России';
    expect(titleSimilarity(a, b)).toBeGreaterThanOrEqual(2);
  });

  it('возвращает 0 для полностью разных заголовков', () => {
    expect(titleSimilarity('Футбол чемпионат мира', 'Экономика инфляция рубль')).toBe(0);
  });

  it('симметричен: similarity(a,b) === similarity(b,a)', () => {
    const a = 'Переговоры России Украины завершились';
    const b = 'Завершились переговоры Украины России';
    expect(titleSimilarity(a, b)).toBe(titleSimilarity(b, a));
  });
});

describe('areSimilar', () => {
  it('возвращает true для похожих заголовков (≥2 общих токена)', () => {
    const a = 'Центральный банк России повысил ключевую ставку';
    const b = 'Банк России повысил ставку до рекордного уровня';
    expect(areSimilar(a, b)).toBe(true);
  });

  it('возвращает false для разных заголовков', () => {
    const a = 'Чемпионат мира футбол финал';
    const b = 'Инфляция рубль экономика прогноз';
    expect(areSimilar(a, b)).toBe(false);
  });

  it('возвращает false если только 1 общий токен', () => {
    const a = 'Россия объявила мобилизацию резервистов';
    const b = 'Россия провела выборы президента';
    // «россия» — 1 общий токен, этого недостаточно
    expect(areSimilar(a, b)).toBe(false);
  });

  it('возвращает true для почти идентичных заголовков', () => {
    const a = 'Путин подписал указ об экономических санкциях';
    const b = 'Путин подписал указ о новых санкциях против Запада';
    expect(areSimilar(a, b)).toBe(true);
  });

  it('возвращает false для пустых строк', () => {
    expect(areSimilar('', '')).toBe(false);
    expect(areSimilar('Россия санкции экономика', '')).toBe(false);
  });
});

describe('tokenizeNormalized', () => {
  it('применяет нормализацию к токенам', async () => {
    // normalize: заменяет «банка» → «банк» (имитация pymorphy2)
    const normalize = async (tokens: string[]) =>
      tokens.map(t => t === 'банка' ? 'банк' : t);
    const result = await tokenizeNormalized('Банка России решение', normalize);
    expect(result).toBeInstanceOf(Set);
    expect(result.has('банк')).toBe(true);    // нормализовано
    expect(result.has('решение')).toBe(true); // без изменений
    expect(result.has('банка')).toBe(false);  // исходная форма заменена
  });

  it('при деградации (identity) ведёт себя как tokenize', async () => {
    const identity = async (tokens: string[]) => tokens;
    const normalized = await tokenizeNormalized('Банк России повысил ставку', identity);
    const sync = tokenize('Банк России повысил ставку');
    expect([...normalized].sort()).toEqual([...sync].sort());
  });
});

describe('areSimilarNormalized', () => {
  it('находит похожие заголовки с нормализацией падежей', async () => {
    // Имитируем pymorphy2: «банка» → «банк», «ставке» → «ставка»
    const normalize = async (tokens: string[]) =>
      tokens.map(t => ({ банка: 'банк', ставке: 'ставка', ставку: 'ставка' }[t] ?? t));

    const a = 'Банк России повысил ставку';
    const b = 'Банка России решение по ставке'; // без нормализации: 1 общий токен
    expect(await areSimilarNormalized(a, b, normalize)).toBe(true);
  });

  it('без нормализации те же заголовки не кластеризуются', () => {
    const a = 'Банк России повысил ставку';
    const b = 'Банка России решение по ставке';
    expect(areSimilar(a, b)).toBe(false);
  });

  it('деградация к identity не ломает логику', async () => {
    const identity = async (tokens: string[]) => tokens;
    const a = 'Путин подписал указ об экономических санкциях';
    const b = 'Путин подписал указ о новых санкциях против Запада';
    expect(await areSimilarNormalized(a, b, identity)).toBe(true);
  });

  it('возвращает false для пустых строк', async () => {
    const identity = async (tokens: string[]) => tokens;
    expect(await areSimilarNormalized('', '', identity)).toBe(false);
  });
});
