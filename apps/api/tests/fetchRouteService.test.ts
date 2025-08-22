// Назначение: автотесты. Модули: jest, supertest.
// Тест сервиса fetchRoute
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

jest.mock('../../web/src/utils/authFetch');
const authFetch = require('../../web/src/utils/authFetch').default;

const { fetchRoute } = require('../../web/src/services/route');

afterEach(() => {
  jest.resetAllMocks();
});
afterAll(() => {
  stopScheduler();
  stopQueue();
});

test('fetchRoute использует authFetch', async () => {
  authFetch.mockResolvedValue({ ok: true, json: async () => ({ d: 1 }) });
  await fetchRoute({ lat: 1, lng: 2 }, { lat: 3, lng: 4 });
  expect(authFetch).toHaveBeenCalledWith(
    '/api/v1/route',
    expect.objectContaining({ method: 'POST' }),
  );
});
