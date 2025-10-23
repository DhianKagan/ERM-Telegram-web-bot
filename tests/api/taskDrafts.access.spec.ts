/**
 * Назначение файла: интеграционный тест доступа к черновикам задач для обычных пользователей.
 * Основные модули: express, supertest, path.
 */
import express = require('express');
import request = require('supertest');
import path = require('path');
import { strict as assert } from 'assert';
import { ACCESS_USER } from '../../apps/api/src/utils/accessMask';

const previousMongoUrl = process.env.MONGO_DATABASE_URL;
process.env.MONGO_DATABASE_URL =
  'mongodb://admin:admin@localhost:27017/ermdb?authSource=admin';

declare const before: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;
declare const after: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;
declare const describe: (
  name: string,
  suite: (this: unknown) => void,
) => void;
declare const it: (
  name: string,
  test: (this: unknown) => unknown | Promise<unknown>,
) => void;

describe('Task drafts access', function () {
  const suite = this as { timeout?: (ms: number) => void };
  suite.timeout?.(60000);

  let app: express.Express;

  before(async function () {
    const hook = this as { timeout?: (ms: number) => void };
    hook.timeout?.(60000);

    const jestApi = (global as typeof globalThis & {
      jest: {
        mock: (moduleId: string, factory: () => unknown) => void;
      };
    }).jest;
    const drafts = new Map<
      string,
      {
        _id: string;
        userId: number;
        kind: 'task' | 'request';
        payload: Record<string, unknown>;
        attachments: unknown[];
        toObject: () => Record<string, unknown>;
      }
    >();
    const serviceModulePath = path.resolve(
      __dirname,
      '../../apps/api/src/taskDrafts/taskDrafts.service',
    );
    jestApi.mock(serviceModulePath, () => ({
      __esModule: true,
      default: class {
        async getDraft(userId: number, kind: 'task' | 'request') {
          const key = `${userId}:${kind}`;
          const draft = drafts.get(key);
          return draft ? { ...draft, attachments: [...draft.attachments] } : null;
        }

        async saveDraft(userId: number, kind: 'task' | 'request', payload: unknown) {
          const normalized =
            payload && typeof payload === 'object'
              ? { ...(payload as Record<string, unknown>) }
              : {};
          const attachments = Array.isArray(normalized.attachments)
            ? [...normalized.attachments]
            : [];
          const record = {
            _id: `${userId}:${kind}`,
            userId,
            kind,
            payload: normalized,
            attachments,
            toObject() {
              return {
                _id: this._id,
                kind: this.kind,
                payload: this.payload,
                attachments: this.attachments,
              };
            },
          };
          drafts.set(`${userId}:${kind}`, record);
          return record;
        }

        async deleteDraft(userId: number, kind: 'task' | 'request') {
          drafts.delete(`${userId}:${kind}`);
        }
      },
    }));
    const authModulePath = path.resolve(
      __dirname,
      '../../apps/api/src/middleware/auth',
    );
    jestApi.mock(authModulePath, () => ({
      __esModule: true,
      default: () =>
        ((req: express.Request, _res: express.Response, next: express.NextFunction) => {
          (req as express.Request & { user?: unknown }).user = {
            id: 101,
            username: 'user',
            access: ACCESS_USER,
          };
          next();
        }) as express.RequestHandler,
    }));

    const router = (await import('../../apps/api/src/routes/taskDrafts')).default;

    app = express();
    app.use(express.json());
    app.use('/api/v1/task-drafts', router);
  });

  after(async () => {
    if (previousMongoUrl === undefined) {
      delete process.env.MONGO_DATABASE_URL;
    } else {
      process.env.MONGO_DATABASE_URL = previousMongoUrl;
    }
    // Очистка не требуется для моков в данном тесте.
  });

  it('позволяет пользователю сохранить и получить черновик заявки', async () => {
    const saveResponse = await request(app)
      .put('/api/v1/task-drafts/request')
      .set('Authorization', 'Bearer test-token')
      .send({ payload: { title: 'demo' } });

    assert.equal(saveResponse.status, 200);
    assert.equal(saveResponse.body.kind, 'request');
    assert.equal(saveResponse.body.payload.title, 'demo');

    const fetchResponse = await request(app)
      .get('/api/v1/task-drafts/request')
      .set('Authorization', 'Bearer test-token');

    assert.equal(fetchResponse.status, 200);
    assert.equal(fetchResponse.body.kind, 'request');
    assert.equal(fetchResponse.body.payload.title, 'demo');
  });
});
