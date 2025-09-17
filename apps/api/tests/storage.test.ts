// Назначение: тесты роутов управления файлами. Модули: jest, supertest.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 's';
process.env.APP_URL = 'https://localhost';

const express = require('express');
const request = require('supertest');
const fs = require('fs');
const path = require('path');

jest.mock('../src/db/model', () => ({
  File: {
    find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
    findOneAndDelete: jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(null),
    })),
  },
  Task: { updateOne: jest.fn() },
}));

process.env.STORAGE_DIR = path.resolve(__dirname, '../public/uploads');
const router = require('../src/routes/storage').default;
const { uploadsDir } = require('../src/config/storage');
const { File } = require('../src/db/model');
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
    (File.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          userId: 1,
          name: 'test.txt',
          path: 'test.txt',
          type: 'text/plain',
          size: 1,
          uploadedAt: new Date(),
          _id: '64d000000000000000000001',
        },
      ]),
    });
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].name).toBe('test.txt');
    expect(res.body[0].previewUrl).toContain('?mode=inline');
  });

  test('delete file', async () => {
    const f = path.join(uploadsDir, 'del.txt');
    fs.writeFileSync(f, 'd');
    (File.findOneAndDelete as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ path: 'del.txt' }),
    });
    await request(app).delete('/del.txt').expect(200);
    expect(fs.existsSync(f)).toBe(false);
  });
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
