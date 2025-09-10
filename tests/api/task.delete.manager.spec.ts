/**
 * Назначение файла: e2e-тест удаления задачи менеджером.
 * Основные модули: express, supertest.
 */
import express = require('express');
import request = require('supertest');
import { strict as assert } from 'assert';

const app = express();
let checked = false;
const checkTaskAccess = (_req: any, _res: any, next: any) => {
  checked = true;
  next();
};
app.delete('/tasks/:id', (req, res) => {
  const role = req.headers['x-role'];
  if (role !== 'admin') {
    res.sendStatus(403);
    return;
  }
  checkTaskAccess(req, res, () => res.sendStatus(204));
});

describe('Удаление задач', () => {
  it('менеджеру запрещено удалять', async () => {
    const res = await request(app).delete('/tasks/1').set('x-role', 'manager');
    assert.equal(res.status, 403);
    assert.equal(checked, false);
  });
});
