/**
 * Точка входа для процесса бота.
 * Изменено: использовать safeStartBot для устойчивого старта (ретраи, не падать при таймаутах).
 *
 * Старое поведение:
 *  startBot()
 *    .then(() => { startScheduler(); startKeyRotation(); })
 *    .catch((error) => { console.error(...); process.exit(1); });
 *
 * Новое поведение:
 *  - Пытаемся startBot() несколько раз через safeStartBot.
 *  - При окончательном провале — логируем и продолжаем запуск Scheduler/KeyRotation,
 *    чтобы процесс не падал из-за временной сетевой ошибки.
 */

import mongoose from 'mongoose';
import { closeQueueBundles } from '../queues/taskQueue';
import { startScheduler, stopScheduler } from '../services/scheduler';
import { startKeyRotation, stopKeyRotation } from '../services/keyRotation';
import { stopQueue } from '../services/messageQueue';
import { closeCacheClient } from '../utils/cache';
import { safeStartBot } from './safeStartBot';
import { bot } from './bot';

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    const shutdownTimeoutMs = Number(process.env.SHUTDOWN_TIMEOUT_MS || 30000);
    let shuttingDown = false;

    const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;
      console.log(`Получен сигнал ${signal}, начинаем остановку...`);

      const forceTimer = setTimeout(() => {
        console.error('Принудительное завершение из-за превышения таймаута');
        process.exit(1);
      }, shutdownTimeoutMs);
      forceTimer.unref?.();

      try {
        await bot.stop();
      } catch (error) {
        console.error('runtime: Ошибка при остановке бота', error);
      }

      try {
        stopScheduler();
        stopKeyRotation();
        stopQueue();
      } catch (error) {
        console.error('runtime: Ошибка при остановке фоновых задач', error);
      }

      try {
        await closeQueueBundles();
      } catch (error) {
        console.error('runtime: Ошибка при закрытии очередей', error);
      }

      try {
        await closeCacheClient();
      } catch (error) {
        console.error('runtime: Ошибка при закрытии Redis', error);
      }

      if (mongoose.connection.readyState !== 0) {
        try {
          await mongoose.connection.close(false);
        } catch (error) {
          console.error(
            'runtime: Ошибка при закрытии MongoDB соединения',
            error,
          );
        }
      }

      clearTimeout(forceTimer);
      process.exit(0);
    };

    process.on('SIGINT', () => {
      void shutdown('SIGINT');
    });
    process.on('SIGTERM', () => {
      void shutdown('SIGTERM');
    });

    try {
      const started = await safeStartBot({ attempts: 3, baseDelayMs: 1000 });

      if (!started) {
        // Bot не удалось запустить — логируем подробный совет по диагностике.
        console.warn(
          'runtime: Бот не запущен после повторных попыток. ' +
            'Проверьте доступность https://api.telegram.org из контейнера, ' +
            'корректность BOT_TOKEN, настройки прокси (HTTPS_PROXY / NO_PROXY) и правила egress платформы.',
        );
      } else {
        console.info('runtime: Бот успешно запущен.');
      }

      // Запускаем планировщик и ротацию ключей в любом случае.
      // (Это минимальная модификация, чтобы процесс не падал из-за временных сетевых ошибок.)
      try {
        startScheduler();
        startKeyRotation();
      } catch (innerErr) {
        console.error(
          'runtime: Ошибка при запуске scheduler/keyRotation',
          innerErr,
        );
        // Если запуск scheduler/keyRotation критичен для корректной работы, можно process.exit(1) тут,
        // но по умолчанию логируем и выходим с ошибкой — оставим прежнее поведение для этих сервисов.
        process.exit(1);
      }
    } catch (err) {
      // Защитный catch на случай непредвиденных ошибок в safeStartBot.
      console.error(
        'runtime: Непредвиденная ошибка при запуске процесса бота',
        err,
      );
      process.exit(1);
    }
  })();
}
