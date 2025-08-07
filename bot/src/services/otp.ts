// Сервис генерации и проверки одноразовых кодов
// Модули: telegramApi
import { call } from './telegramApi';

interface CodeEntry {
  code: string;
  ts: number;
}

export const codes = new Map<string, CodeEntry>();
export const attempts = new Map<string, { count: number; ts: number }>();
export const adminCodes = new Map<string, CodeEntry>();
export const adminAttempts = new Map<string, { count: number; ts: number }>();
const EXPIRATION_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function clean(): void {
  const now = Date.now();
  for (const [key, value] of codes) {
    if (now - value.ts > EXPIRATION_MS) codes.delete(key);
  }
  for (const [key, value] of attempts) {
    if (now - value.ts > EXPIRATION_MS) attempts.delete(key);
  }
  for (const [key, value] of adminCodes) {
    if (now - value.ts > EXPIRATION_MS) adminCodes.delete(key);
  }
  for (const [key, value] of adminAttempts) {
    if (now - value.ts > EXPIRATION_MS) adminAttempts.delete(key);
  }
}

setInterval(clean, EXPIRATION_MS).unref();

export interface SendCodePayload {
  telegramId: number;
}

export async function sendCode({ telegramId }: SendCodePayload): Promise<void> {
  clean();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const text = `Код входа для пользователя: ${code}`;
  const key = String(telegramId);
  codes.set(key, { code, ts: Date.now() });
  attempts.delete(key);
  await call('sendMessage', { chat_id: telegramId, text });
}

export async function sendAdminCode({ telegramId }: SendCodePayload): Promise<void> {
  clean();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const text = `Код входа для Админа: ${code}`;
  const key = String(telegramId);
  adminCodes.set(key, { code, ts: Date.now() });
  adminAttempts.delete(key);
  await call('sendMessage', { chat_id: telegramId, text });
}

export interface VerifyPayload {
  telegramId: number;
  code: string;
}

export function verifyCode({ telegramId, code }: VerifyPayload): boolean {
  clean();
  const key = String(telegramId);
  const entry = codes.get(key);
  const info = attempts.get(key) || { count: 0, ts: Date.now() };
  if (
    entry &&
    info.count < MAX_ATTEMPTS &&
    entry.code === code &&
    Date.now() - entry.ts <= EXPIRATION_MS
  ) {
    codes.delete(key);
    attempts.delete(key);
    return true;
  }
  info.count += 1;
  info.ts = Date.now();
  attempts.set(key, info);
  if (info.count >= MAX_ATTEMPTS) codes.delete(key);
  return false;
}

export function verifyAdminCode({ telegramId, code }: VerifyPayload): boolean {
  clean();
  const key = String(telegramId);
  const entry = adminCodes.get(key);
  const info = adminAttempts.get(key) || { count: 0, ts: Date.now() };
  if (
    entry &&
    info.count < MAX_ATTEMPTS &&
    entry.code === code &&
    Date.now() - entry.ts <= EXPIRATION_MS
  ) {
    adminCodes.delete(key);
    adminAttempts.delete(key);
    return true;
  }
  info.count += 1;
  info.ts = Date.now();
  adminAttempts.set(key, info);
  if (info.count >= MAX_ATTEMPTS) adminCodes.delete(key);
  return false;
}


