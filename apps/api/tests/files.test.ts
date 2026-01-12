// Назначение: тесты роута скачивания файлов. Модули: jest, supertest.
import express from 'express';
import fs from 'fs';
import path from 'path';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 's';
process.env.APP_URL = 'https://localhost';

const testUploadsDir = path.resolve(__dirname, '../tmp/uploads-files-test');
process.env.STORAGE_DIR = testUploadsDir;

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
import router from '../src/routes/files';
import { uploadsDir } from '../src/config/storage';
import { File } from '../src/db/model';
import { deleteFile } from '../src/services/fileService';

jest.mock('../src/services/fileService', () => ({
  ...jest.requireActual('../src/services/fileService'),
  deleteFile: jest.fn(),
}));

describe('files route', () => {
  const app = express();
  app.use(router);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (fs.existsSync(testUploadsDir)) {
      fs.rmSync(testUploadsDir, { recursive: true, force: true });
    }
  });

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

  test('serve inline preview with same-origin headers', async () => {
    fs.mkdirSync(uploadsDir, { recursive: true });
    const f = path.join(uploadsDir, 'c.pdf');
    fs.writeFileSync(f, 'pdf-content');
    File.findById.mockReturnValue({
      lean: () =>
        Promise.resolve({
          userId: 1,
          path: 'c.pdf',
          name: 'c.pdf',
          type: 'application/pdf',
        }),
    });
    await request(app)
      .get('/333333333333333333333333?mode=inline')
      .expect(200)
      .expect('content-disposition', 'inline')
      .expect('content-type', 'application/pdf');
    fs.unlinkSync(f);
  });

  test('delete own file', async () => {
    File.findById.mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: '444444444444444444444444',
          userId: 1,
          path: 'd.txt',
          name: 'd.txt',
        }),
    });
    deleteFile.mockResolvedValue(undefined);
    await request(app).delete('/444444444444444444444444').expect(204);
    expect(deleteFile).toHaveBeenCalledWith('444444444444444444444444');
  });

  test('delete returns 404 for missing file', async () => {
    File.findById.mockReturnValue({
      lean: () => Promise.resolve(null),
    });
    await request(app).delete('/555555555555555555555555').expect(404);
    expect(deleteFile).not.toHaveBeenCalled();
  });
});
