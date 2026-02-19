// Назначение: проверяет обязательные env-переменные для split-ролей Railway (api/bot).
// Основные модули: jest, config.
export {};

process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 'token';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 'secret';
process.env.APP_URL = 'https://localhost';
process.env.MONGO_DATABASE_URL =
  'mongodb://mongo:pass@erm-mongodb.railway.internal:27017/ermdb?authSource=admin';

import { stopScheduler } from '../../apps/api/src/services/scheduler';
import { stopQueue } from '../../apps/api/src/services/messageQueue';

const originalEnv = { ...process.env };

describe('APP_ROLE env requirements', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'production';
    delete process.env.JEST_WORKER_ID;
    delete process.env.VITEST_WORKER_ID;
    delete process.env.ALLOW_MISSING_ENV;
    delete process.env.RAILWAY_ENVIRONMENT;
    process.env.JWT_SECRET = 'secret';
    process.env.APP_URL = 'https://example.com';
    process.env.MONGO_DATABASE_URL =
      'mongodb://mongo:pass@erm-mongodb.railway.internal:27017/ermdb?authSource=admin';
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('api-роль стартует без BOT_TOKEN и CHAT_ID', async () => {
    process.env.APP_ROLE = 'api';
    delete process.env.BOT_TOKEN;
    delete process.env.CHAT_ID;

    await expect(import('../../apps/api/src/config')).resolves.toBeDefined();
  });

  test('bot-роль требует BOT_TOKEN', async () => {
    process.env.APP_ROLE = 'bot';
    delete process.env.BOT_TOKEN;
    process.env.CHAT_ID = '123';

    await expect(import('../../apps/api/src/config')).rejects.toThrow(
      'Переменная BOT_TOKEN не задана',
    );
  });
});

afterAll(() => {
  process.env = { ...originalEnv };
  stopScheduler();
  stopQueue();
});
