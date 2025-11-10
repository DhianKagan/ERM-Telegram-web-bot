// Назначение: проверка работы cookie без HTTPS. Модули: jest, supertest.
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 'secret';
process.env.APP_URL = 'https://localhost';
process.env.MONGO_DATABASE_URL =
  'mongodb://admin:admin@localhost:27017/ermdb?authSource=admin';
process.env.ROUTING_URL = 'https://localhost/route';

const request = require('supertest');

const mockRegisterRoutes = jest.fn();

const originalCookieSecure = process.env.COOKIE_SECURE;
const originalSessionSecret = process.env.SESSION_SECRET;

jest.mock('../src/db/connection', () => ({
  __esModule: true,
  default: jest.fn(async () => ({})),
}));

jest.mock('../src/db/model', () => ({
  __esModule: true,
}));

jest.mock('../src/services/diskSpace', () => ({
  startDiskMonitor: jest.fn(),
}));

jest.mock('../src/api/routes', () => ({
  __esModule: true,
  default: mockRegisterRoutes,
}));

describe('COOKIE_SECURE=false', () => {
  beforeEach(() => {
    jest.resetModules();
    mockRegisterRoutes.mockReset();
    process.env.COOKIE_SECURE = 'false';
    process.env.SESSION_SECRET = 'test-secret';
    mockRegisterRoutes.mockImplementation(async (app, cookieFlags) => {
      app.post('/api/test-login', (_req, res) => {
        res.cookie('token', 'demo', cookieFlags);
        res.json({ authorized: true });
      });
    });
  });

  afterEach(() => {
    if (originalCookieSecure === undefined) {
      delete process.env.COOKIE_SECURE;
    } else {
      process.env.COOKIE_SECURE = originalCookieSecure;
    }
    if (originalSessionSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = originalSessionSecret;
    }
  });

  test('cookie выдаётся и авторизация завершается успехом', async () => {
    const { buildApp } = require('../src/api/server');
    const app = await buildApp();
    const res = await request(app).post('/api/test-login');
    expect(res.status).toBe(200);
    expect(res.body.authorized).toBe(true);
    const cookies = res.headers['set-cookie'];
    expect(Array.isArray(cookies)).toBe(true);
    expect(cookies[0]).toMatch(/token=demo/);
    expect(cookies[0]).toMatch(/SameSite=Lax/);
    expect(cookies[0]).not.toMatch(/Secure/);
    const [, cookieFlags] = mockRegisterRoutes.mock.calls[0];
    expect(cookieFlags.sameSite).toBe('lax');
    expect(cookieFlags.secure).toBe(false);
  });
});
