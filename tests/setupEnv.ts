/**
 * Назначение файла: настройка переменных окружения и полифиллов для юнит-тестов.
 * Основные модули: process, util, mongoose.
 */

import Module, { createRequire } from 'module';
import path from 'path';
import type { Mongoose } from 'mongoose';
import { TextDecoder, TextEncoder } from 'util';

const requireForMock = createRequire(__filename);

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockImplementation: (
    implementation: (...args: unknown[]) => unknown,
  ) => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockRejectedValue: (reason: unknown) => MockFunction;
};

type JestLike = {
  fn: (implementation?: (...args: unknown[]) => unknown) => MockFunction;
  mock: (moduleId: string, factory: () => unknown) => void;
};

const ensureJest = (): JestLike => {
  const globalAny = global as typeof globalThis & { jest?: unknown };
  const existingJest = globalAny.jest as JestLike | undefined;
  if (existingJest) {
    return existingJest;
  }

  const createMockFn = (
    implementation?: (...args: unknown[]) => unknown,
  ): MockFunction => {
    let currentImplementation = implementation;
    const mockFn: MockFunction = ((...args: unknown[]) => {
      if (!currentImplementation) {
        return undefined;
      }
      return currentImplementation(...args);
    }) as MockFunction;
    mockFn.mockImplementation = (impl) => {
      currentImplementation = impl;
      return mockFn;
    };
    mockFn.mockResolvedValue = (value) => {
      currentImplementation = async () => value;
      return mockFn;
    };
    mockFn.mockRejectedValue = (reason) => {
      currentImplementation = async () => {
        throw reason;
      };
      return mockFn;
    };
    return mockFn;
  };

  const jestShim: JestLike = {
    fn: createMockFn,
    mock(moduleId, factory) {
      const resolvedPath = requireForMock.resolve(moduleId);
      const mockedModule = {
        id: resolvedPath,
        filename: resolvedPath,
        loaded: true,
        exports: factory(),
        children: [],
        paths: [],
      } as unknown as NodeJS.Module;
      (requireForMock.cache as Record<string, NodeJS.Module | undefined>)[
        resolvedPath
      ] = mockedModule;
    },
  };

  Object.defineProperty(globalAny, 'jest', {
    value: jestShim,
    configurable: true,
    writable: true,
  });
  return jestShim;
};

const jestApi = ensureJest();

jestApi.mock('../apps/api/src/utils/delay', () => ({
  __esModule: true,
  default: jestApi.fn(async () => {}),
  delay: jestApi.fn(async () => {}),
}));

const modulePrototype = (
  Module as unknown as {
    prototype: NodeJS.Module & {
      __ermMongoosePatched?: boolean;
    };
  }
).prototype;
if (!modulePrototype.__ermMongoosePatched) {
  const appMongoosePath = path.resolve(
    __dirname,
    '../apps/api/node_modules/mongoose',
  );
  const originalRequire = Module.prototype.require;
  Module.prototype.require = function patchedRequire(id: string) {
    if (id === 'mongoose') {
      return originalRequire.call(this, appMongoosePath);
    }
    return originalRequire.call(this, id);
  };
  modulePrototype.__ermMongoosePatched = true;
}

process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN ||= 'test-bot-token';
process.env.CHAT_ID ||= '0';
process.env.JWT_SECRET ||= 'test-secret';
process.env.APP_URL ||= 'https://example.com';
process.env.MONGO_DATABASE_URL ||=
  'mongodb://admin:admin@localhost:27017/ermdb?authSource=admin';
process.env.RETRY_ATTEMPTS ||= '0';
process.env.SUPPRESS_LOGS ||= '1';
process.env.QUEUE_REDIS_URL = '';
process.env.REDIS_URL = '';
process.env.ROUTE_CACHE_REDIS_URL = '';
process.env.MONGOMS_DOWNLOAD_IGNORE_MISSING_HEADER ||= '1';

// Увеличиваем тайм-аут буфера операций синхронно, чтобы дождаться запуска MongoMemoryServer в CI
const applyBufferTimeout = (mongoose: Mongoose): void => {
  mongoose.set('bufferTimeoutMS', 60000);
};

if (process.env.JEST_WORKER_ID) {
  void import('mongoose')
    .then(({ default: mongoose }) => {
      applyBufferTimeout(mongoose);
    })
    .catch(() => undefined);
} else {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const mongoose: Mongoose = require('mongoose');
  applyBufferTimeout(mongoose);
}

(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder as any;
