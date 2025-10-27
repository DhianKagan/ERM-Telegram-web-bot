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
    delete process.env.MONGO_URL;
    delete process.env.MONGO_PUBLIC_URL;
    delete process.env.MONGODB_URL;
    delete process.env.MONGO_DATABASE_NAME;
    delete process.env.MONGO_AUTH_SOURCE;
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
    const config = require('../../apps/api/src/config');
    expect(config.mongoUrl).toBe(
      'mongodb://mongo:pass@erm-mongodb.railway.internal:27017/ermdb?authSource=admin',
    );
  });

  test('использует MONGO_URL и добавляет имя базы', () => {
    delete process.env.MONGO_DATABASE_URL;
    process.env.MONGO_URL =
      'mongodb://mongo:pass@erm-mongodb.railway.internal:27017';
    const config = require('../../apps/api/src/config');
    expect(config.mongoUrl).toBe(
      'mongodb://mongo:pass@erm-mongodb.railway.internal:27017/ermdb?authSource=admin',
    );
  });

  test('подставляет имя базы из MONGO_DATABASE_NAME', () => {
    delete process.env.MONGO_DATABASE_URL;
    process.env.MONGO_URL =
      'mongodb://mongo:pass@erm-mongodb.railway.internal:27017';
    process.env.MONGO_DATABASE_NAME = 'customdb';
    const config = require('../../apps/api/src/config');
    expect(config.mongoUrl).toBe(
      'mongodb://mongo:pass@erm-mongodb.railway.internal:27017/customdb?authSource=admin',
    );
  });
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
