// Назначение: тесты роутов управления файлами. Модули: jest, supertest.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 's';
process.env.APP_URL = 'https://localhost';

const express = require('express');
const request = require('supertest');
const fs = require('fs');
const path = require('path');

const mockDiagnosticsController = {
  diagnose: jest.fn((_req: any, res: any) => res.json({ ok: true })),
  remediate: jest.fn((_req: any, res: any) => res.json({ ok: true })),
};

jest.mock('../src/di', () => {
  const resolve = jest.fn(() => mockDiagnosticsController);
  return {
    __esModule: true,
    default: { resolve },
    container: { resolve },
  };
});

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
  app.use(express.json());
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
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(f, 'd');
    (File.findOneAndDelete as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ path: 'del.txt' }),
    });
    await request(app).delete('/del.txt').expect(200);
    expect(fs.existsSync(f)).toBe(false);
  });

  test('diagnostics endpoint delegates to controller', async () => {
    await request(app).get('/diagnostics').expect(200);
    expect(mockDiagnosticsController.diagnose).toHaveBeenCalled();
  });

  test('remediate endpoint делегирует контроллеру', async () => {
    await request(app)
      .post('/diagnostics/fix')
      .send({ actions: [] })
      .expect(200);
    expect(mockDiagnosticsController.remediate).toHaveBeenCalled();
  });
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
