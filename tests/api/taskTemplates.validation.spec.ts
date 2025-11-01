/**
 * Назначение файла: проверка валидации роута получения шаблона задачи.
 * Основные модули: express, supertest, problem details.
 */
import express from 'express';
import request from 'supertest';
import { strict as assert } from 'assert';
import type { RequestHandler } from 'express';

declare const describe: (
  name: string,
  suite: (this: unknown) => void,
) => void;
declare const it: (
  name: string,
  test: (this: unknown) => unknown | Promise<unknown>,
) => void;

describe('GET /api/v1/task-templates/:id', function () {
  const suite = this as { timeout?: (ms: number) => void };
  suite.timeout?.(5000);

  it('возвращает 400 и не вызывает контроллер при невалидном ObjectId', async function () {
    const caseCtx = this as { timeout?: (ms: number) => void };
    caseCtx.timeout?.(5000);
    const diPath = require.resolve('../../apps/api/src/di');
    const authPath = require.resolve('../../apps/api/src/middleware/auth');
    const routerPath = require.resolve(
      '../../apps/api/src/routes/taskTemplates',
    );
    const controllerPath = require.resolve(
      '../../apps/api/src/taskTemplates/taskTemplates.controller',
    );

    let detailCalls = 0;

    const controllerStub = {
      list: ((req, res) => {
        res.json([]);
      }) as RequestHandler,
      detail: ((req, res) => {
        detailCalls += 1;
        res.json({ ok: true });
      }) as RequestHandler,
      create: [
        ((req, res) => {
          res.status(201).json({ ok: true });
        }) as RequestHandler,
      ],
    };

    const containerStub = {
      resolve: () => controllerStub,
    };

    const originalDiModule = require.cache[diPath];
    require.cache[diPath] = {
      id: diPath,
      filename: diPath,
      loaded: true,
      exports: {
        __esModule: true,
        default: containerStub,
        container: containerStub,
      },
    } as NodeModule;

    const originalAuthModule = require.cache[authPath];
    require.cache[authPath] = {
      id: authPath,
      filename: authPath,
      loaded: true,
      exports: {
        __esModule: true,
        default: () => ((req, res, next) => next()) as RequestHandler,
      },
    } as NodeModule;

    const originalControllerModule = require.cache[controllerPath];
    require.cache[controllerPath] = {
      id: controllerPath,
      filename: controllerPath,
      loaded: true,
      exports: {
        __esModule: true,
        default: class {
          list = controllerStub.list;
          detail = controllerStub.detail;
          create = controllerStub.create;
        },
      },
    } as NodeModule;

    const originalRouterModule = require.cache[routerPath];

    try {
      const routerModule = await import('../../apps/api/src/routes/taskTemplates');
      const router = routerModule.default;

      const app = express();
      app.use(express.json());
      app.use('/api/v1/task-templates', router);

      const response = await request(app).get(
        '/api/v1/task-templates/not-a-valid-object-id',
      );

      assert.equal(response.status, 400);
      assert.equal(response.type, 'application/problem+json');
      assert.equal(detailCalls, 0);
      assert.match(response.body.detail, /id/i);
    } finally {
      if (originalRouterModule) {
        require.cache[routerPath] = originalRouterModule;
      } else {
        delete require.cache[routerPath];
      }

      if (originalControllerModule) {
        require.cache[controllerPath] = originalControllerModule;
      } else {
        delete require.cache[controllerPath];
      }

      if (originalDiModule) {
        require.cache[diPath] = originalDiModule;
      } else {
        delete require.cache[diPath];
      }

      if (originalAuthModule) {
        require.cache[authPath] = originalAuthModule;
      } else {
        delete require.cache[authPath];
      }
    }
  });
});

