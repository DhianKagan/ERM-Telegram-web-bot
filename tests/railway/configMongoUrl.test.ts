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
    delete process.env.MONGO_USERNAME;
    delete process.env.MONGO_PASSWORD;
    delete process.env.MONGO_USER;
    delete process.env.MONGODB_USER;
    delete process.env.MONGODB_USERNAME;
    delete process.env.MONGO_PASS;
    delete process.env.MONGODB_PASS;
    delete process.env.MONGO_INITDB_ROOT_USERNAME;
    delete process.env.MONGO_INITDB_ROOT_PASSWORD;
  });

  afterEach(() => {
    jest.resetModules();
    delete process.env.MONGO_USERNAME;
    delete process.env.MONGO_PASSWORD;
    delete process.env.MONGO_USER;
    delete process.env.MONGODB_USER;
    delete process.env.MONGODB_USERNAME;
    delete process.env.MONGO_PASS;
    delete process.env.MONGODB_PASS;
    delete process.env.MONGO_INITDB_ROOT_USERNAME;
    delete process.env.MONGO_INITDB_ROOT_PASSWORD;
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

  test('бросает ошибку для публичного прокси Railway без authSource', () => {
    process.env.MONGO_DATABASE_URL =
      'mongodb://mongo:pass@shinkansen.proxy.rlwy.net:43551/ermdb';
    expect(() => require('../../apps/api/src/config')).toThrow(
      'Для MongoDB Railway добавьте параметр authSource=admin в MONGO_DATABASE_URL',
    );
  });

  test('дополняет строку логином и паролем из отдельных переменных', () => {
    process.env.MONGO_DATABASE_URL =
      'mongodb://erm-mongodb.railway.internal:27017/ermdb?authSource=admin';
    process.env.MONGO_USERNAME = 'mongo';
    process.env.MONGO_PASSWORD = 'pass!23';

    const config = require('../../apps/api/src/config');
    const parsed = new URL(config.mongoUrl);

    expect(parsed.username).toBe('mongo');
    expect(parsed.password).toBe('pass!23');
    expect(process.env.MONGO_DATABASE_URL).toBe(config.mongoUrl);
  });
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
