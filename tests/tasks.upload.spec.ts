/**
 * Назначение файла: проверка загрузки и скачивания вложений задач.
 * Основные модули: express, supertest, multer.
 */
import express, { RequestHandler } from 'express';
import request from 'supertest';
// @ts-ignore
import multer from '../bot/node_modules/multer';
import path from 'path';
import fs from 'fs';
import { processUploads, uploadsDir } from '../bot/src/routes/tasks';

const upload = multer({ storage: multer.memoryStorage() });
const app = express();
app.post(
  '/tasks',
  upload.any() as any,
  processUploads as unknown as RequestHandler,
  (req, res) => {
    res.status(201).json({ attachments: (req.body as any).attachments });
  },
);
app.use('/uploads', express.static(uploadsDir));

describe('Загрузка и скачивание вложений', () => {
  test('загружает файл и позволяет скачать', async () => {
    const res = await request(app)
      .post('/tasks')
      .attach('files', Buffer.from('hello'), 'test.txt');
    expect(res.status).toBe(201);
    const atts = res.body.attachments as { name: string; url: string }[];
    expect(atts[0].name).toBe('test.txt');
    const fileRes = await request(app).get(atts[0].url);
    expect(fileRes.text).toBe('hello');
    fs.unlinkSync(path.join(uploadsDir, path.basename(atts[0].url)));
  });
});
