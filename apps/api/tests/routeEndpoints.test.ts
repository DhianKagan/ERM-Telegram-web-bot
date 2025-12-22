process.env.APP_URL = 'https://localhost';

describe('маршруты OSRM', () => {
  beforeEach(async () => {
    jest.resetModules();
    const promClient = await import('prom-client');
    const registryKey = Symbol.for('erm.metrics.register');
    const globalSymbols = global as Record<symbol, unknown>;
    const customRegistry = globalSymbols[registryKey] as
      | { clear?: () => void }
      | undefined;
    if (customRegistry && typeof customRegistry.clear === 'function') {
      customRegistry.clear();
    }
    delete globalSymbols[registryKey];
    promClient.register.clear();
    process.env.ROUTING_URL =
      'https://router.project-osrm.org/route/v1/driving';
    process.env.ROUTE_CACHE_ENABLED = '0';
    const { clearRouteCache } = await import('../src/services/route');
    await clearRouteCache();
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ code: 'Ok', routes: [{ geometry: null }] }),
      json: async () => ({ code: 'Ok', routes: [{ geometry: null }] }),
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('table использует профиль и координаты в пути', async () => {
    const { table } = await import('../src/services/route');
    await table('1,1;2,2', {});

    const calledUrl = new URL(
      (fetch as jest.Mock).mock.calls[0][0] as string,
    );
    expect(calledUrl.pathname).toBe('/table/v1/driving/1,1;2,2');
    expect(calledUrl.searchParams.get('points')).toBeNull();
  });

  test('routeGeometry передает координаты в путь', async () => {
    const { routeGeometry } = await import('../src/services/route');
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          code: 'Ok',
          routes: [{ geometry: { coordinates: [[1, 2]] } }],
        }),
      json: async () => ({
        code: 'Ok',
        routes: [{ geometry: { coordinates: [[1, 2]] } }],
      }),
    });

    const result = await routeGeometry('1,1;2,2');
    const calledUrl = new URL(
      (fetch as jest.Mock).mock.calls[0][0] as string,
    );
    expect(calledUrl.pathname).toBe('/route/v1/driving/1,1;2,2');
    expect(result).toEqual([[1, 2]]);
  });

  test('getRouteDistance добавляет координаты в путь', async () => {
    const { getRouteDistance } = await import('../src/services/route');
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          code: 'Ok',
          routes: [{ distance: 1234 }],
          waypoints: [{ name: 'a' }, { name: 'b' }],
        }),
      json: async () => ({
        code: 'Ok',
        routes: [{ distance: 1234 }],
        waypoints: [{ name: 'a' }, { name: 'b' }],
      }),
    });

    const result = await getRouteDistance(
      { lat: 1, lng: 2 },
      { lat: 1.5, lng: 2.5 },
    );
    const calledUrl = new URL(
      (fetch as jest.Mock).mock.calls[0][0] as string,
    );
    expect(calledUrl.pathname).toBe('/route/v1/driving/2,1;2.5,1.5');
    expect(result.distance).toBe(1234);
  });
});
