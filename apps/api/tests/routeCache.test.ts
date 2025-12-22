process.env.APP_URL = 'https://localhost';
const { table, clearRouteCache } = require('../src/services/route');

global.fetch = jest.fn(async () => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ code: 'Ok' }),
  json: async () => ({ code: 'Ok' }),
})) as unknown as typeof fetch;

describe('кеширование запросов OSRM', () => {
  beforeEach(async () => {
    (fetch as jest.Mock).mockClear();
    await clearRouteCache();
  });

  test('повторный запрос берётся из кеша', async () => {
    process.env.ROUTE_CACHE_ENABLED = '1';
    await table('1,1;2,2', {});
    await table('1,1;2,2', {});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
