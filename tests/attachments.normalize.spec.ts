/**
 * Назначение файла: проверка нормализации вложений из JSON-строки.
 * Основные модули: express, supertest, multer, routes/tasks.
 */
import express = require('express');
import request = require('supertest');
// @ts-ignore
import multer from '../apps/api/node_modules/multer';
import { normalizeArrays } from '../apps/api/src/routes/tasks';

const app = express();
const upload = multer();

app.post('/tasks', upload.none() as any, normalizeArrays as any, (req, res) => {
  res.json({ attachments: (req.body as any).attachments });
});

describe('Нормализация вложений', () => {
  test('парсит строку в массив объектов', async () => {
    const payload = [
      {
        name: 'f.png',
        url: '/f',
        uploadedBy: 1,
        uploadedAt: new Date().toISOString(),
        type: 'image/png',
        size: 1,
      },
    ];
    const res = await request(app)
      .post('/tasks')
      .field('attachments', JSON.stringify(payload));
    expect(res.body.attachments[0].name).toBe('f.png');
  });
});
