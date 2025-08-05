// Назначение: автотесты. Модули: jest, supertest.
// Тесты функции getRouteDistance сервиса маршрутов
process.env.ROUTING_URL = 'http://localhost:8000/route';
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const { getRouteDistance } = require('../src/services/route');

afterEach(() => {
  jest.resetAllMocks();
});

test('getRouteDistance возвращает дистанцию', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ code: 'Ok', routes: [{ distance: 1000 }], waypoints: [] }),
  });
  const res = await getRouteDistance({ lat: 1, lng: 2 }, { lat: 3, lng: 4 });
  expect(res.distance).toBe(1000);
});

test('getRouteDistance выбрасывает ошибку при неверном ответе', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ code: 'Bad' }),
  });
  await expect(
    getRouteDistance({ lat: 1, lng: 2 }, { lat: 3, lng: 4 }),
  ).rejects.toThrow('Bad');
});

