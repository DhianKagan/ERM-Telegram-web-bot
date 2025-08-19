// Назначение: тесты роутов управления файлами. Модули: jest, supertest.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 's';
process.env.APP_URL = 'https://localhost';

const express = require('express');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const router = require('../src/routes/storage').default;
const { uploadsDir } = require('../src/routes/tasks');
const { stopQueue } = require('../src/services/messageQueue');
const { stopScheduler } = require('../src/services/scheduler');

jest.mock(
  '../src/middleware/auth',
  () => () => (_req: any, _res: any, next: any) => next(),
);
jest.mock(
  '../src/auth/roles.guard',
  () => (_req: any, _res: any, next: any) => next(),
);
jest.mock('../src/auth/roles.decorator', () => ({
  Roles: () => (_req: any, _res: any, next: any) => next(),
}));

describe('storage routes', () => {
  const app = express();
  app.use(router);

  test('list files', async () => {
    const f = path.join(uploadsDir, 'test.txt');
    fs.writeFileSync(f, 't');
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    fs.unlinkSync(f);
  });

  test('delete file', async () => {
    const f = path.join(uploadsDir, 'del.txt');
    fs.writeFileSync(f, 'd');
    await request(app).delete('/del.txt').expect(200);
    expect(fs.existsSync(f)).toBe(false);
  });
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
