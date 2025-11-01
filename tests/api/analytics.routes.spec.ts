/**
 * Назначение файла: проверка подключения маршрута аналитики в API.
 * Основные модули: express, supertest, path.
 */
import express = require('express');
import request = require('supertest');
import path = require('path');
import { strict as assert } from 'assert';
import type { CookieOptions } from 'express-session';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

declare const describe: (
  name: string,
  suite: (this: unknown) => void,
) => void;
declare const it: (
  name: string,
  test: (this: unknown) => unknown | Promise<unknown>,
) => void;
declare const before: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;
declare const after: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;

describe('API маршруты аналитики', function () {
  const suite = this as { timeout?: (ms: number) => void };
  suite.timeout?.(60000);

  let app: express.Express;
  const mockedModuleIds = new Set<string>();

  before(async function () {
    const hook = this as { timeout?: (ms: number) => void };
    hook.timeout?.(60000);

    process.env.DISABLE_CSRF = '1';

    const jestApi = (global as typeof globalThis & {
      jest: {
        mock: (moduleId: string, factory: () => unknown) => void;
      };
    }).jest;

    const registerMock = (modulePath: string, factory: () => unknown): void => {
      jestApi.mock(modulePath, factory);
      const resolvedPath = require.resolve(modulePath);
      mockedModuleIds.add(resolvedPath);
    };

    const mockRouterModule = (relativePath: string): void => {
      const modulePath = path.resolve(__dirname, relativePath);
      registerMock(modulePath, () => ({
        __esModule: true,
        default: express.Router(),
      }));
    };

    const routerModules: readonly string[] = [
      '../../apps/api/src/routes/tasks',
      '../../apps/api/src/routes/taskDrafts',
      '../../apps/api/src/routes/maps',
      '../../apps/api/src/routes/route',
      '../../apps/api/src/routes/routes',
      '../../apps/api/src/routes/optimizer',
      '../../apps/api/src/routes/authUser',
      '../../apps/api/src/routes/users',
      '../../apps/api/src/routes/roles',
      '../../apps/api/src/routes/logs',
      '../../apps/api/src/routes/taskTemplates',
      '../../apps/api/src/routes/storage',
      '../../apps/api/src/routes/files',
      '../../apps/api/src/routes/fleets',
      '../../apps/api/src/routes/departments',
      '../../apps/api/src/routes/employees',
      '../../apps/api/src/routes/tracking',
      '../../apps/api/src/routes/collections',
      '../../apps/api/src/routes/archives',
      '../../apps/api/src/routes/system',
      '../../apps/api/src/routes/routePlans',
    ];

    routerModules.forEach((relativePath) => {
      mockRouterModule(relativePath);
    });

    registerMock(
      path.resolve(__dirname, '../../apps/api/src/utils/rateLimiter'),
      () => ({
        __esModule: true,
        default: () =>
          ((_: Request, __: Response, next: NextFunction) => next()) as RequestHandler,
      }),
    );

    registerMock(
      path.resolve(__dirname, '../../apps/api/src/middleware/globalLimiter'),
      () => ({
        __esModule: true,
        default: ((_req: Request, _res: Response, next: NextFunction) =>
          next()) as RequestHandler,
      }),
    );

    registerMock(
      path.resolve(__dirname, '../../apps/api/src/api/middleware'),
      () => {
        const asyncHandler = <T extends RequestHandler>(handler: T): RequestHandler => {
          return (req: Request, res: Response, next: NextFunction) => {
            Promise.resolve(handler(req, res, next)).catch(next);
          };
        };
        return {
          __esModule: true,
          verifyToken: (_req: Request, _res: Response, next: NextFunction) => next(),
          asyncHandler,
          requestLogger: (_req: Request, _res: Response, next: NextFunction) => next(),
          apiErrors: { inc: () => undefined },
        };
      },
    );

    registerMock(
      path.resolve(__dirname, '../../apps/api/src/middleware/auth'),
      () => ({
        __esModule: true,
        default: () => (_req: Request, _res: Response, next: NextFunction) => next(),
      }),
    );

    registerMock(
      path.resolve(__dirname, '../../apps/api/src/services/routePlanAnalytics'),
      () => ({
        __esModule: true,
        fetchRoutePlanAnalytics: async () => ({ totalPlans: 1 }),
      }),
    );

    registerMock(
      path.resolve(__dirname, '../../apps/api/src/metrics'),
      () => ({
        __esModule: true,
        register: {
          contentType: 'text/plain',
          metrics: async () => 'metrics',
        },
      }),
    );

    registerMock(
      path.resolve(__dirname, '../../apps/api/src/di'),
      () => ({
        __esModule: true,
        default: {
          resolve: () => (_req: Request, _res: Response, next: NextFunction) => next(),
        },
      }),
    );

    registerMock(
      path.resolve(__dirname, '../../apps/api/src/di/tokens'),
      () => ({
        __esModule: true,
        TOKENS: { TmaAuthGuard: 'TmaAuthGuard' },
      }),
    );

    registerMock(
      path.resolve(__dirname, '../../apps/api/src/auth/auth.service'),
      () => ({
        __esModule: true,
        default: { verifyTmaLogin: async () => 'stub-token' },
      }),
    );

    registerMock(
      path.resolve(__dirname, '../../apps/api/src/services/service'),
      () => ({
        __esModule: true,
        updateTaskStatus: async () => ({ completed_at: null }),
        writeLog: async () => undefined,
        listMentionedTasks: async () => [],
        getTask: async () => ({
          assignees: [],
          controllers: [],
          created_by: 1,
        }),
      }),
    );

    registerMock(
      path.resolve(__dirname, '../../apps/api/src/services/shortLinks'),
      () => ({
        __esModule: true,
        getShortLinkPathPrefix: () => '/s',
        resolveShortLinkBySlug: async () => null,
      }),
    );

    registerMock(
      path.resolve(__dirname, '../../apps/api/src/middleware/taskAccess'),
      () => ({
        __esModule: true,
        default: (_req: Request, _res: Response, next: NextFunction) => next(),
      }),
    );

    registerMock(
      path.resolve(__dirname, '../../apps/api/src/api/healthcheck'),
      () => ({
        __esModule: true,
        default: async (_req: Request, res: Response) => {
          res.json({ status: 'ok' });
        },
      }),
    );

    registerMock(
      path.resolve(__dirname, '../../apps/api/src/api/swagger'),
      () => ({
        __esModule: true,
        swaggerUi: {
          serve: (_req: Request, _res: Response, next: NextFunction) => next(),
          setup: () => (_req: Request, _res: Response, next: NextFunction) => next(),
        },
        specs: {},
      }),
    );

    registerMock(
      path.resolve(__dirname, '../../apps/api/src/middleware/errorMiddleware'),
      () => ({
        __esModule: true,
        default: (_err: unknown, _req: Request, res: Response) => {
          if (!res.headersSent) {
            res.status(500).json({ error: 'stub' });
          }
        },
      }),
    );

    const registerRoutesModule = await import('../../apps/api/src/api/routes');
    const registerRoutes = registerRoutesModule.default;

    mockedModuleIds.add(
      require.resolve(path.resolve(__dirname, '../../apps/api/src/api/routes')),
    );

    app = express();
    app.use(express.json());
    const cookieFlags: CookieOptions = {};
    const publicDir = path.resolve(__dirname, '../../apps/api/public');
    await registerRoutes(app, cookieFlags, publicDir);
  });

  it('возвращает JSON для аналитики маршрутных планов', async () => {
    const response = await request(app).get(
      '/api/v1/analytics/route-plans/summary',
    );

    assert.equal(response.status, 200);
    const contentType = response.headers['content-type'];
    assert.ok(contentType && contentType.includes('application/json'));
    assert.equal(response.body.totalPlans, 1);
    assert.equal(response.text.includes('<!DOCTYPE html>'), false);
  });

  after(() => {
    mockedModuleIds.forEach((moduleId) => {
      delete require.cache[moduleId];
    });
    mockedModuleIds.clear();
  });
});
