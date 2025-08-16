// Назначение: тесты роутов подписи R2. Модули: jest, supertest.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 's';

import express from 'express';
import request from 'supertest';

jest.mock(
  '../src/middleware/auth',
  () => () => (req: any, _res: any, next: any) => {
    req.user = { id: 1 };
    next();
  },
);

const mockCreateUpload = jest.fn();
const mockGetUpload = jest.fn();

jest.mock('../src/db/queries', () => ({
  createUpload: (data: unknown) => mockCreateUpload(data),
  getUpload: (key: string) => mockGetUpload(key),
}));

import router from '../src/r2';

describe('роуты R2', () => {
  const app = express();
  app.use(router);

  test('sign-upload сохраняет метаданные', async () => {
    await request(app)
      .post('/sign-upload?key=test.txt')
      .set('Content-Length', '10')
      .set('Content-Type', 'text/plain')
      .expect(200);
    expect(mockCreateUpload).toHaveBeenCalledWith({
      key: 'test.txt',
      mime: 'text/plain',
      size: 10,
      owner: 1,
    });
  });

  test('sign-get проверяет владельца', async () => {
    mockGetUpload.mockResolvedValue({
      key: 'test.txt',
      mime: 'text/plain',
      size: 10,
      owner: 1,
    });
    const res = await request(app).get('/sign-get?key=test.txt');
    expect(res.status).toBe(200);
    expect(res.body.mime).toBe('text/plain');
  });

  test('sign-get отклоняет чужой файл', async () => {
    mockGetUpload.mockResolvedValue({
      key: 'test.txt',
      mime: 'text/plain',
      size: 10,
      owner: 2,
    });
    const res = await request(app).get('/sign-get?key=test.txt');
    expect(res.status).toBe(403);
  });
});
