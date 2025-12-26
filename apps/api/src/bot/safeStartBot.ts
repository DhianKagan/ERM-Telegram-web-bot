/**
 * Safe start wrapper for the bot.
 *
 * Цель: попытаться запустить startBot() несколько раз с экспоненциальным бэкоффом,
 * при окончательном провале — не убивать процесс, а вернуть false и залогировать ошибку.
 *
 * Это минимальная защита от ситуаций, когда на старте контейнера сеть недоступна
 * (например, ETIMEDOUT к api.telegram.org) и процесс падает/перезапускается PM2.
 */

import { startBot } from './bot';

type Options = {
  attempts?: number;
  baseDelayMs?: number;
  // Доп. условие: считать ошибку "фатальной" и не пытаться снова (опционально)
  // isFatal?: (err: unknown) => boolean;
};

const DEFAULTS: Required<Options> = {
  attempts: 3,
  baseDelayMs: 1000,
};

function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function safeStartBot(opts?: Options): Promise<boolean> {
  const { attempts, baseDelayMs } = { ...DEFAULTS, ...(opts ?? {}) };

  for (let i = 0; i < attempts; i += 1) {
    try {
      // Запускаем реальный старт бота (внутри startBot может быть deleteWebhook и пр.)
      await startBot();
      console.info('safeStartBot: startBot успешно выполнен');
      return true;
    } catch (err) {
      // Логируем подробно — важно для диагностики (code/errno, message)
      const code = (err as any)?.code ?? (err as any)?.errno ?? null;
      const message =
        (err as any)?.message ||
        (err as any)?.description ||
        (typeof err === 'string' ? err : undefined);
      console.error(
        `safeStartBot: попытка ${i + 1} из ${attempts} завершилась ошибкой. code=${String(
          code,
        )} message=${String(message)}`,
        err,
      );

      // Если это последняя попытка — выдаём итоговый лог и НЕ выкидываем исключение,
      // чтобы не завершать процесс (runtime.ts будет решать, что делать дальше).
      if (i === attempts - 1) {
        console.error(
          'safeStartBot: не удалось запустить startBot после всех попыток. ' +
            'Продолжаем работу процесса без падения. Проверьте сетевое соединение/прокси/настройки платформы.',
        );
        return false;
      }

      // Экспоненциальный бэкофф перед следующей попыткой
      const delay = baseDelayMs * Math.pow(2, i);
      console.info(`safeStartBot: ожидание ${delay}ms перед следующей попыткой...`);
      // eslint-disable-next-line no-await-in-loop
      await wait(delay);
    }
  }

  // Защита: теоретически сюда не попадём, но возвращаем false на всякий случай.
  return false;
}
