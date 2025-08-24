// Назначение: тесты роута скачивания файлов. Модули: jest, supertest.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 's';
process.env.APP_URL = 'https://localhost';

const express = require('express');
const request = require('supertest');
const fs = require('fs');
const path = require('path');

jest.mock('../src/db/model', () => ({
  File: { findById: jest.fn() },
  Task: {
    findById: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
  },
}));
jest.mock('../src/middleware/auth', () => () => (req, _res, next) => {
  req.user = { id: 1, access: 1 };
  next();
});

const router = require('../src/routes/files').default;
const { uploadsDir } = require('../src/config/storage');
const { File } = require('../src/db/model');

describe('files route', () => {
  const app = express();
  app.use(router);

  test('deny access for foreign file', async () => {
    File.findById.mockReturnValue({
      lean: () => Promise.resolve({ userId: 2, path: 'a.txt', name: 'a.txt' }),
    });
    const res = await request(app).get('/111111111111111111111111');
    expect(res.status).toBe(403);
  });

  test('serve own file', async () => {
    fs.mkdirSync(uploadsDir, { recursive: true });
    const f = path.join(uploadsDir, 'b.txt');
    fs.writeFileSync(f, 'b');
    File.findById.mockReturnValue({
      lean: () => Promise.resolve({ userId: 1, path: 'b.txt', name: 'b.txt' }),
    });
    await request(app)
      .get('/222222222222222222222222')
      .expect(200)
      .expect('content-disposition', /b.txt/);
    fs.unlinkSync(f);
  });
});
