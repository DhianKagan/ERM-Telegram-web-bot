/**
 * Назначение файла: настройка переменных окружения и полифиллов для юнит-тестов.
 * Основные модули: process, util.
 */

process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN ||= 'test-bot-token';
process.env.CHAT_ID ||= '0';
process.env.JWT_SECRET ||= 'test-secret';
process.env.APP_URL ||= 'https://example.com';
process.env.MONGO_DATABASE_URL ||=
  'mongodb://admin:admin@localhost:27017/ermdb?authSource=admin';
process.env.RETRY_ATTEMPTS ||= '0';
process.env.SUPPRESS_LOGS ||= '1';

// Увеличиваем тайм-аут буфера операций, чтобы дождаться запуска MongoMemoryServer в CI
void import('mongoose')
  .then(({ default: mongoose }) => {
    mongoose.set('bufferTimeoutMS', 30000);
  })
  .catch(() => undefined);

import { TextDecoder, TextEncoder } from 'util';
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder as any;
