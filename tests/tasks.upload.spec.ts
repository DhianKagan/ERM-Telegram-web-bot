/**
 * Назначение файла: проверка загрузки и скачивания вложений задач.
 * Основные модули: express, supertest, multer, sharp.
 */
import express = require('express');
import type { Request, RequestHandler } from 'express';
import request = require('supertest');
import rateLimit = require('express-rate-limit');
// @ts-ignore
import multer from '../apps/api/node_modules/multer';
import * as path from 'path';
import * as fs from 'fs';
import { processUploads } from '../apps/api/src/routes/tasks';
import { uploadsDir } from '../apps/api/src/config/storage';

const storage = multer.diskStorage({
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, dest: string) => void,
  ) => {
    const dest = path.join(uploadsDir, '1');
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, name: string) => void,
  ) => {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });
const app = express();
const setUser: RequestHandler = (req, _res, next) => {
  (req as any).user = { id: 1 };
  next();
};
const limiter = rateLimit({ windowMs: 60 * 1000, max: 50 });
app.post(
  '/tasks',
  setUser,
  limiter,
  upload.any() as any,
  processUploads as unknown as RequestHandler,
  (req, res) => {
    res.status(201).json({ attachments: (req.body as any).attachments });
  },
);
app.use('/uploads', express.static(uploadsDir));

describe('Загрузка и скачивание вложений', () => {
  // Тест пропущен: в окружении отсутствует поддержка sharp.
  test.skip('загружает изображение и создаёт миниатюру', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wIAAgMBApfo5k0AAAAASUVORK5CYII=',
      'base64',
    );
    const res = await request(app)
      .post('/tasks')
      .attach('files', png, { filename: 'test.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    const atts = res.body.attachments as {
      name: string;
      url: string;
      thumbnailUrl: string;
    }[];
    expect(atts[0].name).toBe('test.png');
    expect(atts[0].thumbnailUrl).toBeDefined();
    const fileRes = await request(app).get(atts[0].url);
    expect(fileRes.status).toBe(200);
    const thumbRes = await request(app).get(atts[0].thumbnailUrl);
    expect(thumbRes.status).toBe(200);
    fs.unlinkSync(path.join(uploadsDir, '1', path.basename(atts[0].url)));
    fs.unlinkSync(
      path.join(uploadsDir, '1', path.basename(atts[0].thumbnailUrl)),
    );
  });
});
