/**
 * Назначение файла: настройка переменных окружения и полифиллов для юнит-тестов.
 * Основные модули: process, util, mongoose.
 */

import type { Mongoose } from 'mongoose';
import { TextDecoder, TextEncoder } from 'util';

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
