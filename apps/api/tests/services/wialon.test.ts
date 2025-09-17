// Назначение: проверка маппинга данных Wialon
// Основные модули: jest, node-fetch, wialon сервис
jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import fetch from 'node-fetch';
import {
  login,
  loadUnits,
  loadTrack,
  parseLocatorLink,
} from '../../src/services/wialon';

const mockedFetch = fetch as unknown as jest.Mock;

describe('wialon service', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('отправляет запрос на авторизацию', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sid: 'sid', eid: 'eid', user: { id: 1 } }),
    });
    const result = await login('token', 'https://example.com');
    expect(result.sid).toBe('sid');
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockedFetch.mock.calls[0];
    expect(url).toBe('https://example.com/wialon/ajax.html');
    const body = opts?.body as URLSearchParams;
    expect(body.get('svc')).toBe('token/login');
    expect(body.get('params')).toContain('token');
  });

  it('парсит ссылку локатора', () => {
    const link = 'https://hosting.wialon.com/locator?lang=ru&t=dG9rZW4tdmFsdWUtMTIz';
    const parsed = parseLocatorLink(link);
    expect(parsed.token).toBe('token-value-123');
    expect(parsed.baseUrl).toBe('https://hst-api.wialon.com');
    expect(parsed.locatorKey).toBe('dG9rZW4tdmFsdWUtMTIz');
    expect(parsed.locatorUrl).toBe(link);
  });

  it('отклоняет ссылку без валидного t', () => {
    expect(() => parseLocatorLink('https://hosting.wialon.com/locator?t=???')).toThrow(
      'Ключ локатора содержит недопустимые символы',
    );
  });

  it('нормализует список юнитов', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 7,
            nm: 'Трактор',
            pos: { x: 30, y: 60, t: 1000, s: 15, c: 90 },
            sens: [
              {
                id: 1,
                n: 'Топливо',
                value: 25,
                last_update: 1200,
              },
            ],
          },
        ],
      }),
    });
    const units = await loadUnits('sid', 'https://hst');
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({
      id: 7,
      name: 'Трактор',
      position: { lat: 60, lon: 30, speed: 15, course: 90 },
    });
    expect(units[0].sensors[0].name).toBe('Топливо');
    expect(units[0].sensors[0].value).toBe(25);
  });

  it('возвращает точки трека', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        track: [{ x: 50, y: 55, t: 2000, s: 20, c: 45 }],
      }),
    });
    const points = await loadTrack(
      'sid',
      3,
      new Date('2024-01-01T00:00:00.000Z'),
      new Date('2024-01-01T01:00:00.000Z'),
      'https://hst',
    );
    expect(points).toEqual([
      {
        lat: 55,
        lon: 50,
        speed: 20,
        course: 45,
        timestamp: new Date(2000 * 1000),
      },
    ]);
  });
});
