// Назначение: проверка выбора порта в конфиге Railway.
// Основные модули: jest, config.
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 'token';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 'secret';
process.env.APP_URL = 'https://localhost';
process.env.MONGO_DATABASE_URL =
  'mongodb://mongo:pass@erm-mongodb.railway.internal:27017/ermdb?authSource=admin';

const { stopScheduler } = require('../../apps/api/src/services/scheduler');
const { stopQueue } = require('../../apps/api/src/services/messageQueue');

const originalEnv = { ...process.env };

describe('config port detection', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.MONGO_DATABASE_URL =
      'mongodb://mongo:pass@erm-mongodb.railway.internal:27017/ermdb?authSource=admin';
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('предпочитает RAILWAY_TCP_PORT', () => {
    process.env.RAILWAY_TCP_PORT = '51234';
    process.env.PORT = '3001';

    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const config = require('../../apps/api/src/config');

    expect(config.port).toBe(51234);
    expect(warnSpy).toHaveBeenCalledWith(
      'Railway принудительно использует порт 51234, игнорируем PORT=3001.',
    );

    warnSpy.mockRestore();
  });

  test('игнорирует HOST_PORT', () => {
    process.env.HOST_PORT = '8080';
    process.env.PORT = '4567';

    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const config = require('../../apps/api/src/config');

    expect(config.port).toBe(4567);
    expect(warnSpy).toHaveBeenCalledWith(
      'HOST_PORT=8080 не используется веб-сервером, используем порт 4567.',
    );

    warnSpy.mockRestore();
  });

  test('возвращает порт по умолчанию при некорректных значениях', () => {
    process.env.PORT = 'abc';
    process.env.RAILWAY_TCP_PORT = '';
    process.env.HOST_PORT = '-1';

    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const config = require('../../apps/api/src/config');

    expect(config.port).toBe(3000);
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

afterAll(() => {
  process.env = { ...originalEnv };
  stopScheduler();
  stopQueue();
});
