// Назначение: проверка валидации Mongo URL в конфиге. Модули: jest, services.
export {};

process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 'token';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 'secret';
process.env.APP_URL = 'https://localhost';
process.env.MONGO_DATABASE_URL =
  'mongodb://mongo:pass@erm-mongodb.railway.internal:27017/ermdb?authSource=admin';

const { stopScheduler } = require('../../apps/api/src/services/scheduler');
const { stopQueue } = require('../../apps/api/src/services/messageQueue');

describe('MONGO_DATABASE_URL validation', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.MONGO_DATABASE_URL =
      'mongodb://mongo:pass@erm-mongodb.railway.internal:27017/ermdb?authSource=admin';
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('бросает ошибку, если не указана база данных', () => {
    process.env.MONGO_DATABASE_URL =
      'mongodb://mongo:pass@erm-mongodb.railway.internal:27017';
    expect(() => require('../../apps/api/src/config')).toThrow(
      'MONGO_DATABASE_URL должен содержать имя базы данных после хоста, например /ermdb',
    );
  });

  test('бросает ошибку для Railway без authSource=admin', () => {
    process.env.MONGO_DATABASE_URL =
      'mongodb://mongo:pass@erm-mongodb.railway.internal:27017/ermdb';
    expect(() => require('../../apps/api/src/config')).toThrow(
      'Для MongoDB Railway добавьте параметр authSource=admin в MONGO_DATABASE_URL',
    );
  });
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
