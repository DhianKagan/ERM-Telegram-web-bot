// Назначение: автотесты. Модули: jest, supertest.
// Тесты функции getRouteDistance сервиса маршрутов
process.env.ROUTING_URL = 'https://localhost:8000/route';
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';
process.env.ROUTE_CACHE_ENABLED = '0';

const { getRouteDistance, clearRouteCache } = require('../src/services/route');

beforeEach(async () => {
  await clearRouteCache();
});

afterEach(async () => {
  jest.resetAllMocks();
  await clearRouteCache();
});

test('getRouteDistance возвращает дистанцию', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        code: 'Ok',
        routes: [{ distance: 1000 }],
        waypoints: [],
      }),
    json: async () => ({
      code: 'Ok',
      routes: [{ distance: 1000 }],
      waypoints: [],
    }),
  });
  const res = await getRouteDistance(
    { lat: 1, lng: 2 },
    { lat: 1.5, lng: 2.5 },
  );
  expect(res.distance).toBe(1000);
});

test('getRouteDistance выбрасывает ошибку при неверном ответе', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 500,
    text: async () => JSON.stringify({ code: 'Bad' }),
    json: async () => ({ code: 'Bad' }),
  });
  await expect(
    getRouteDistance({ lat: 1, lng: 2 }, { lat: 1.5, lng: 2.5 }),
  ).rejects.toThrow('Bad');
});
