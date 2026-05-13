import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchHourlyRange } from '../infrastructure/weather/OpenMeteoClient';

describe('fetchHourlyRange', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              hourly: {
                time: ['2026-05-01T00:00', '2026-05-01T01:00', '2026-05-02T00:00'],
                temperature_2m: [1, 2, 3],
                weathercode: [0, 1, 2],
                windspeed_10m: [10, 11, 12],
                precipitation: [0, 0.1, 0],
              },
            }),
        })
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('делает один запрос с start_date и end_date и разбивает почасовку по date', async () => {
    const rows = await fetchHourlyRange(55.75, 37.62, 'Europe/Moscow', '2026-05-01', '2026-05-02');

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      date: '2026-05-01',
      time: '00',
      temp: 1,
    });
    expect(rows[2]).toMatchObject({
      date: '2026-05-02',
      time: '00',
      temp: 3,
    });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('start_date=2026-05-01');
    expect(url).toContain('end_date=2026-05-02');
  });
});
