// Назначение: автотесты. Модули: jest.
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.JWT_SECRET = 's';
process.env.APP_URL = 'https://localhost';

import { call } from '../src/services/telegramApi';
import { stopScheduler } from '../src/services/scheduler';
import { stopQueue } from '../src/services/messageQueue';

test('telegramApi игнорирует ошибку chat not found', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({
      ok: false,
      description: 'Bad Request: chat not found',
    }),
  });

  const result = await call('sendMessage', { chat_id: 1, text: 't' });

  expect(result).toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(1);
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
