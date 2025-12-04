// Назначение: конфигурация логгера воркера BullMQ
// Основные модули: pino
import pino from 'pino';

const level = (process.env.LOG_LEVEL || 'info').trim() || 'info';

export const logger = pino({
  name: 'bullmq-worker',
  level,
});
