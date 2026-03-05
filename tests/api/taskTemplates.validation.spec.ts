/**
 * Назначение файла: проверка валидации роута получения шаблона задачи.
 * Основные модули: express, supertest, express-validator, problem details.
 */
import express from 'express';
import request from 'supertest';
import { strict as assert } from 'assert';
import { param } from 'express-validator';
import { handleValidation } from '../../apps/api/src/utils/validate';

declare const describe: (name: string, suite: (this: unknown) => void) => void;
declare const it: (
  name: string,
  test: (this: unknown) => unknown | Promise<unknown>,
) => void;

describe('GET /api/v1/task-templates/:id', function () {
  jest.setTimeout(10000);

  it('возвращает 400 и не вызывает контроллер при невалидном ObjectId', async () => {
    let detailCalls = 0;

    const app = express();
    app.get(
      '/api/v1/task-templates/:id',
      param('id').isMongoId(),
      handleValidation,
      (_req, res) => {
        detailCalls += 1;
        res.json({ ok: true });
      },
    );

    const response = await request(app).get(
      '/api/v1/task-templates/not-a-valid-object-id',
    );

    assert.equal(response.status, 400);
    assert.equal(response.type, 'application/problem+json');
    assert.equal(detailCalls, 0);
    assert.match(response.body.detail, /id/i);
  });
});
