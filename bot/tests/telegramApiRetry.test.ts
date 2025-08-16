// Назначение: автотесты. Модули: jest, supertest.
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const telegramApi = require('../src/services/telegramApi');
const { stopQueue } = require('../src/services/messageQueue');

test('call повторяет запрос при ошибке', async () => {
  let attempts = 0;
  global.fetch = jest.fn().mockImplementation(() => {
    attempts++;
    if (attempts < 3) return Promise.reject(new Error('fail'));
    return Promise.resolve({
      ok: true,
      json: async () => ({ ok: true, result: 1 }),
    });
  });
  const res = await telegramApi.call('getMe');
  expect(res).toBe(1);
  expect(fetch).toHaveBeenCalledTimes(3);
});

test('call повторяет запрос при AbortError', async () => {
  let attempts = 0;
  global.fetch = jest.fn().mockImplementation(() => {
    attempts++;
    if (attempts === 1) {
      const err = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ ok: true, result: 1 }),
    });
  });
  const res = await telegramApi.call('getMe');
  expect(res).toBe(1);
  expect(fetch).toHaveBeenCalledTimes(2);
});

afterAll(() => {
  stopQueue();
});
