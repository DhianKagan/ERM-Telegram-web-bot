/**
 * Назначение файла: проверка объединения вложений при multipart-запросе.
 * Основные модули: express, supertest, multer, routes/tasks.
 */
import express = require('express');
import type { Express, RequestHandler } from 'express';
import request = require('supertest');
// @ts-ignore
import multer from '../apps/api/node_modules/multer';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const { Types } = require('../apps/api/node_modules/mongoose');

jest.mock('../apps/api/src/services/antivirus', () => ({
  scanFile: jest.fn(async () => true),
}));

jest.mock('../apps/api/src/services/wgLogEngine', () => ({
  writeLog: jest.fn(),
}));

jest.mock('../apps/api/src/db/model', () => ({
  File: {
    aggregate: jest.fn(async () => []),
    create: jest.fn(async (data: any) => ({
      ...data,
      _id: new Types.ObjectId(),
      uploadedAt: new Date(),
    })),
  },
}));

describe('Объединение вложений', () => {
  let app: Express;
  let storageDir: string;
  let uploadsDir: string;
  const userId = 917;
  const originalStorageDir = process.env.STORAGE_DIR;

  beforeAll(() => {
    jest.resetModules();
    storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'erm-merge-'));
    process.env.STORAGE_DIR = storageDir;
    jest.isolateModules(() => {
      const tasks = require('../apps/api/src/routes/tasks');
      const {
        uploadsDir: configUploadsDir,
      } = require('../apps/api/src/config/storage');
      uploadsDir = configUploadsDir;
      const processUploads: RequestHandler = tasks.processUploads;
      const normalizeArrays: RequestHandler = tasks.normalizeArrays;
      const storage = multer.diskStorage({
        destination: (
          _req: express.Request,
          _file: Express.Multer.File,
          cb: (error: Error | null, destination: string) => void,
        ) => {
          const dest = path.join(uploadsDir, String(userId));
          fs.mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (
          _req: express.Request,
          file: Express.Multer.File,
          cb: (error: Error | null, filename: string) => void,
        ) => {
          cb(null, `stored-${Date.now()}-${file.originalname}`);
        },
      });
      const upload = multer({ storage });
      app = express();
      app.post(
        '/tasks',
        (req, _res, next) => {
          (req as any).user = { id: userId };
          next();
        },
        upload.single('file'),
        (req, _res, next) => {
          if (!req.files && req.file) {
            (req as any).files = [req.file];
          }
          next();
        },
        processUploads,
        normalizeArrays,
        (req, res) => {
          res.json({ attachments: (req.body as any).attachments });
        },
      );
    });
  });

  afterAll(() => {
    process.env.STORAGE_DIR = originalStorageDir;
    fs.rmSync(storageDir, { recursive: true, force: true });
    jest.resetModules();
  });

  it('сохраняет вложения из строки JSON5 и файла', async () => {
    const payload = "[{ url: '/api/v1/files/legacy', name: 'старый отчёт' }]";
    const response = await request(app)
      .post('/tasks')
      .field('attachments', payload)
      .attach('file', Buffer.from('данные'), {
        filename: 'report.txt',
        contentType: 'text/plain',
      });
    expect(response.status).toBe(200);
    const attachments = response.body.attachments as Array<
      Record<string, unknown>
    >;
    expect(attachments).toHaveLength(2);
    expect(attachments[0]).toMatchObject({
      url: '/api/v1/files/legacy',
      name: 'старый отчёт',
    });
    expect(attachments[1]).toMatchObject({
      name: 'report.txt',
      type: 'text/plain',
    });
    expect(typeof attachments[1].url).toBe('string');
    expect(attachments[0].url).not.toBe(attachments[1].url);
  });
});
