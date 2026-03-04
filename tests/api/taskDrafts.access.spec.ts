/**
 * Назначение файла: интеграционный тест доступа к черновикам задач для обычных пользователей.
 * Основные модули: express, supertest, path.
 */
import express from 'express';
import request from 'supertest';
import path from 'path';
import { strict as assert } from 'assert';
import { ACCESS_USER } from '../../apps/api/src/utils/accessMask';

const previousMongoUrl = process.env.MONGO_DATABASE_URL;
process.env.MONGO_DATABASE_URL =
  'mongodb://admin:admin@localhost:27017/ermdb?authSource=admin';

jest.setTimeout(60000);

describe('Task drafts access', () => {
  let app: express.Express;

  beforeAll(async () => {
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
    jest.doMock(serviceModulePath, () => ({
      __esModule: true,
      default: class {
        async getDraft(userId: number, kind: 'task' | 'request') {
          const key = `${userId}:${kind}`;
          const draft = drafts.get(key);
          return draft
            ? { ...draft, attachments: [...draft.attachments] }
            : null;
        }

        async saveDraft(
          userId: number,
          kind: 'task' | 'request',
          payload: unknown,
        ) {
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
    jest.doMock(authModulePath, () => ({
      __esModule: true,
      default: () =>
        ((
          req: express.Request,
          _res: express.Response,
          next: express.NextFunction,
        ) => {
          (req as express.Request & { user?: unknown }).user = {
            id: 101,
            username: 'user',
            access: ACCESS_USER,
          };
          next();
        }) as express.RequestHandler,
    }));

    const router = (await import('../../apps/api/src/routes/taskDrafts'))
      .default;

    app = express();
    app.use(express.json());
    app.use('/api/v1/task-drafts', router);
  });

  afterAll(async () => {
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

  it('возвращает 204 для отсутствующего черновика', async () => {
    const response = await request(app)
      .get('/api/v1/task-drafts/task')
      .set('Authorization', 'Bearer test-token');

    assert.equal(response.status, 204);
    assert.equal(response.text, '');
  });
});
