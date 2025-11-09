// Сервис прямых вызовов Telegram Bot API
// Модули: fetch, config, AbortController
import { botToken, botApiUrl } from '../config';

const BASE = `${botApiUrl || 'https://api.telegram.org'}/bot${botToken}/`;

export interface TelegramResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
}

/**
 * Вызов метода Telegram API с повторными попытками
 */
export async function call<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
  attempt = 0,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(BASE + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    const data: TelegramResponse<T> = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.description);
    return data.result;
  } catch (err) {
    if (attempt < 3) {
      const delay = 2 ** attempt * 500;
      await new Promise((r) => setTimeout(r, delay));
      return call(method, params, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
