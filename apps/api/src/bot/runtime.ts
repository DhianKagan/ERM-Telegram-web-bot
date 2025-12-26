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

import { startScheduler } from '../services/scheduler';
import { startKeyRotation } from '../services/keyRotation';
import { safeStartBot } from './safeStartBot';

if (process.env.NODE_ENV !== 'test') {
  (async () => {
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
        console.error('runtime: Ошибка при запуске scheduler/keyRotation', innerErr);
        // Если запуск scheduler/keyRotation критичен для корректной работы, можно process.exit(1) тут,
        // но по умолчанию логируем и выходим с ошибкой — оставим прежнее поведение для этих сервисов.
        process.exit(1);
      }
    } catch (err) {
      // Защитный catch на случай непредвиденных ошибок в safeStartBot.
      console.error('runtime: Непредвиденная ошибка при запуске процесса бота', err);
      process.exit(1);
    }
  })();
}
