/**
 * Назначение файла: настройка переменных окружения и полифиллов для юнит-тестов.
 * Основные модули: process, util, mongoose.
 */

import Module from 'module';
import path from 'path';
import type { Mongoose } from 'mongoose';
import { TextDecoder, TextEncoder } from 'util';

jest.mock('../apps/api/src/utils/delay', () => ({
  __esModule: true,
  default: jest.fn(async () => {}),
  delay: jest.fn(async () => {}),
}));

const modulePrototype = (Module as unknown as {
  prototype: NodeJS.Module & {
    __ermMongoosePatched?: boolean;
  };
}).prototype;
if (!modulePrototype.__ermMongoosePatched) {
  const appMongoosePath = path.resolve(__dirname, '../apps/api/node_modules/mongoose');
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
