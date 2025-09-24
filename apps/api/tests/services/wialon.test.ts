// Назначение: проверка маппинга данных Wialon
// Основные модули: jest, глобальный fetch, wialon сервис
import { login, loadUnits, loadTrack, parseLocatorLink } from '../../src/services/wialon';

const mockedFetch = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
let originalFetch: typeof fetch;

describe('wialon service', () => {
  beforeAll(() => {
    originalFetch = global.fetch;
    global.fetch = mockedFetch as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('отправляет запрос на авторизацию', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ sid: 'sid', eid: 'eid', user: { id: 1 } }),
    } as unknown as Awaited<ReturnType<typeof fetch>>);
    const result = await login('token', 'https://example.com');
    expect(result.sid).toBe('sid');
    expect(result.baseUrl).toBe('https://example.com');
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockedFetch.mock.calls[0];
    expect(url).toBe('https://example.com/wialon/ajax.html');
    const body = opts?.body as URLSearchParams;
    expect(body.get('svc')).toBe('token/login');
    expect(body.get('params')).toContain('token');
  });

  it('очищает base64 JSON токен перед авторизацией', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ sid: 'sid', eid: 'eid', user: { id: 1 } }),
    } as unknown as Awaited<ReturnType<typeof fetch>>);
    const payload = Buffer.from(
      JSON.stringify({ token: 'clean-token', extra: 1 }),
      'utf8',
    ).toString('base64');
    const result = await login(payload, 'https://example.com');
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [, opts] = mockedFetch.mock.calls[0];
    const body = opts?.body as URLSearchParams;
    const paramsRaw = body.get('params');
    expect(paramsRaw).toBeTruthy();
    const params = paramsRaw ? JSON.parse(paramsRaw) : null;
    expect(params).not.toBeNull();
    expect((params as { token?: string }).token).toBe('clean-token');
    expect(result.baseUrl).toBe('https://example.com');
  });

  it('использует core/use_auth_hash при ошибке 400', async () => {
    const authHash =
      'fb4bcbccf4815a386eface22e0afc0b0524DE7B5134AB9B26EAAA61C328F1558C5AB5967';
    mockedFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      } as unknown as Awaited<ReturnType<typeof fetch>>)
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      } as unknown as Awaited<ReturnType<typeof fetch>>)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ sid: 'sid', eid: 'eid', user: { id: 1 } }),
      } as unknown as Awaited<ReturnType<typeof fetch>>);
    const result = await login(authHash, 'https://example.com');
    expect(result.sid).toBe('sid');
    expect(result.baseUrl).toBe('https://example.com');
    expect(mockedFetch).toHaveBeenCalledTimes(3);
    const firstBody = mockedFetch.mock.calls[0][1]?.body as URLSearchParams;
    expect(firstBody.get('svc')).toBe('core/use_auth_hash');
    const secondBody = mockedFetch.mock.calls[1][1]?.body as URLSearchParams;
    expect(secondBody.get('svc')).toBe('token/login');
    const thirdBody = mockedFetch.mock.calls[2][1]?.body as URLSearchParams;
    expect(thirdBody.get('svc')).toBe('core/use_auth_hash');
    const paramsRaw = thirdBody.get('params');
    expect(paramsRaw).toBeTruthy();
    const params = paramsRaw ? JSON.parse(paramsRaw) : null;
    expect(params).toMatchObject({ authHash });
  });

  it('использует core/use_auth_hash при ошибке Wialon', async () => {
    const authHash =
      'fb4bcbccf4815a386eface22e0afc0b0524DE7B5134AB9B26EAAA61C328F1558C5AB5967';
    mockedFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ error: 7, message: 'Invalid auth hash' }),
      } as unknown as Awaited<ReturnType<typeof fetch>>)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ error: 4, message: 'Invalid token' }),
      } as unknown as Awaited<ReturnType<typeof fetch>>)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ sid: 'sid-2', eid: 'eid', user: { id: 1 } }),
      } as unknown as Awaited<ReturnType<typeof fetch>>);
    const result = await login(authHash, 'https://example.com');
    expect(result.sid).toBe('sid-2');
    expect(result.baseUrl).toBe('https://example.com');
    expect(mockedFetch).toHaveBeenCalledTimes(3);
    const firstBody = mockedFetch.mock.calls[0][1]?.body as URLSearchParams;
    expect(firstBody.get('svc')).toBe('core/use_auth_hash');
    const secondBody = mockedFetch.mock.calls[1][1]?.body as URLSearchParams;
    expect(secondBody.get('svc')).toBe('token/login');
    const thirdBody = mockedFetch.mock.calls[2][1]?.body as URLSearchParams;
    expect(thirdBody.get('svc')).toBe('core/use_auth_hash');
  });

  it('повторяет авторизацию на стандартном хосте при ошибке 400', async () => {
    const authHash =
      'fb4bcbccf4815a386eface22e0afc0b0524DE7B5134AB9B26EAAA61C328F1558C5AB5967';
    mockedFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      } as unknown as Awaited<ReturnType<typeof fetch>>)
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      } as unknown as Awaited<ReturnType<typeof fetch>>)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ error: 4, message: 'Invalid token' }),
      } as unknown as Awaited<ReturnType<typeof fetch>>)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ sid: 'sid-fallback', eid: 'eid', user: { id: 1 } }),
      } as unknown as Awaited<ReturnType<typeof fetch>>);

    const result = await login(authHash, 'https://example.com');
    expect(result.sid).toBe('sid-fallback');
    expect(result.baseUrl).toBe('https://hst-api.wialon.com');
    expect(mockedFetch).toHaveBeenCalledTimes(4);

    const firstCall = mockedFetch.mock.calls[0];
    expect(firstCall?.[0]).toBe('https://example.com/wialon/ajax.html');
    const secondCall = mockedFetch.mock.calls[1];
    expect(secondCall?.[0]).toBe('https://example.com/wialon/ajax.html');
    const thirdCall = mockedFetch.mock.calls[2];
    expect(thirdCall?.[0]).toBe('https://example.com/wialon/ajax.html');
    const fourthCall = mockedFetch.mock.calls[3];
    expect(fourthCall?.[0]).toBe('https://hst-api.wialon.com/wialon/ajax.html');

    const firstBody = firstCall?.[1]?.body as URLSearchParams;
    expect(firstBody.get('svc')).toBe('core/use_auth_hash');
    const secondBody = secondCall?.[1]?.body as URLSearchParams;
    expect(secondBody.get('svc')).toBe('token/login');
    const thirdBody = thirdCall?.[1]?.body as URLSearchParams;
    expect(thirdBody.get('svc')).toBe('core/use_auth_hash');
    const fourthBody = fourthCall?.[1]?.body as URLSearchParams;
    expect(fourthBody.get('svc')).toBe('core/use_auth_hash');
  });

  it('парсит ссылку локатора', () => {
    const link = 'https://hosting.wialon.com/locator?lang=ru&t=dG9rZW4tdmFsdWUtMTIz';
    const parsed = parseLocatorLink(link);
    expect(parsed.token).toBe('token-value-123');
    expect(parsed.baseUrl).toBe('https://hst-api.wialon.com');
    expect(parsed.locatorKey).toBe('dG9rZW4tdmFsdWUtMTIz');
    expect(parsed.locatorUrl).toBe(link);
  });

  it('поддерживает кириллические символы в токене', () => {
    const originalToken = 'пароль123';
    const locatorKey = Buffer.from(originalToken, 'utf8').toString('base64');
    const link = `https://hosting.wialon.com/locator?t=${locatorKey}`;
    const parsed = parseLocatorLink(link);
    expect(parsed.token).toBe(originalToken);
  });

  it('поддерживает параметр token', () => {
    const locatorKey = Buffer.from('token-value-123', 'utf8').toString('base64');
    const link = `https://hosting.wialon.com/locator?token=${locatorKey}`;
    const parsed = parseLocatorLink(link);
    expect(parsed.token).toBe('token-value-123');
    expect(parsed.locatorKey).toBe(locatorKey);
  });

  it('поддерживает параметр T в верхнем регистре', () => {
    const locatorKey = Buffer.from('token-upper', 'utf8').toString('base64');
    const link = `https://hosting.wialon.com/locator?T=${locatorKey}`;
    const parsed = parseLocatorLink(link);
    expect(parsed.token).toBe('token-upper');
    expect(parsed.locatorKey).toBe(locatorKey);
  });

  it('сохраняет сырой ключ при невозможности декодировать base64', () => {
    const rawKey = 'raw-token';
    const link = `https://hosting.wialon.com/locator?t=${rawKey}`;
    const parsed = parseLocatorLink(link);
    expect(parsed.token).toBe(rawKey);
    expect(parsed.locatorKey).toBe(rawKey);
  });

  it('сохраняет токен из параметра t без base64', () => {
    const rawKey = 'token-value-123';
    const link = `https://hosting.wialon.com/locator?t=${rawKey}`;
    const parsed = parseLocatorLink(link);
    expect(parsed.token).toBe(rawKey);
    expect(parsed.locatorKey).toBe(rawKey);
  });

  it('поддерживает разрешённые символы в сыром токене', () => {
    const rawKey = '-._~@:';
    const link = `https://hosting.wialon.com/locator?t=${encodeURIComponent(rawKey)}`;
    const parsed = parseLocatorLink(link);
    expect(parsed.token).toBe(rawKey);
    expect(parsed.locatorKey).toBe('-._~@:');
  });

  it('поддерживает токен в hash', () => {
    const rawKey = 'raw-hash-token';
    const link = `https://hosting.wialon.com/locator#token=${rawKey}`;
    const parsed = parseLocatorLink(link);
    expect(parsed.token).toBe(rawKey);
    expect(parsed.locatorKey).toBe(rawKey);
  });

  it('поддерживает hashbang с параметром token', () => {
    const rawKey = 'hashbang-token';
    const link = `https://hosting.wialon.com/locator#!/token=${rawKey}`;
    const parsed = parseLocatorLink(link);
    expect(parsed.token).toBe(rawKey);
    expect(parsed.locatorKey).toBe(rawKey);
  });

  it('поддерживает hashbang с параметром t', () => {
    const token = 'hashbang-t';
    const locatorKey = Buffer.from(token, 'utf8').toString('base64');
    const link = `https://hosting.wialon.com/locator#!/?t=${locatorKey}`;
    const parsed = parseLocatorLink(link);
    expect(parsed.token).toBe(token);
    expect(parsed.locatorKey).toBe(locatorKey);
  });

  it('извлекает токен из JSON в hash', () => {
    const rawKey = 'json-token';
    const payload = encodeURIComponent(JSON.stringify({ token: rawKey, map: 1 }));
    const link = `https://hosting.wialon.com/locator/index.html#${payload}`;
    const parsed = parseLocatorLink(link);
    expect(parsed.token).toBe(rawKey);
    expect(parsed.locatorKey).toBe(rawKey);
  });

  it('находит токен во вложенном JSON', () => {
    const rawKey = 'nested-token';
    const payload = encodeURIComponent(
      JSON.stringify({ options: { params: { token: rawKey } } }),
    );
    const link = `https://hosting.wialon.com/locator/index.html#${payload}`;
    const parsed = parseLocatorLink(link);
    expect(parsed.token).toBe(rawKey);
    expect(parsed.locatorKey).toBe(rawKey);
  });

  it('использует сырой ключ если декодированный токен содержит непечатные символы', () => {
    const rawKey = 'fb4bcbccf4815a386eface22e0afc0b0524DE7B5134AB9B26EAAA61C328F1558C5AB5967';
    const link = `https://wialon.gps-garant.com.ua/locator/index.html?t=${rawKey}`;
    const parsed = parseLocatorLink(link);
    expect(parsed.token).toBe(rawKey);
    expect(parsed.locatorKey).toBe(rawKey);
  });

  it('отклоняет ключ с непечатными символами', () => {
    const url = new URL('https://hosting.wialon.com/locator');
    const invalidKey = `raw-${String.fromCharCode(7)}`;
    url.searchParams.set('t', invalidKey);
    expect(() => parseLocatorLink(url.toString())).toThrow(
      'Ключ локатора содержит недопустимые символы',
    );
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
