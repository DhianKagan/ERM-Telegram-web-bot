// Назначение файла: проверка подписи initData Telegram WebApp
// Основные модули: crypto, config
import crypto from 'node:crypto';
import config from '../config';

const { botToken } = config;

interface ValidateOptions {
  expiresIn?: number;
}

type TelegramUser = {
  id?: number;
  username?: string;
  [key: string]: unknown;
} | null;

interface InitDataRecord {
  [key: string]: unknown;
  user?: TelegramUser;
  receiver?: Record<string, unknown> | null;
  chat?: Record<string, unknown> | null;
  auth_date?: number;
  authDate?: number;
}

function buildDataCheckString(params: URLSearchParams) {
  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key !== 'hash') {
      pairs.push(`${key}=${value}`);
    }
  });
  return pairs.sort().join('\n');
}

function validateSignature(
  params: URLSearchParams,
  token: string,
  options: ValidateOptions,
) {
  const hash = params.get('hash');
  if (!hash) {
    throw new Error('hash отсутствует');
  }
  const dataString = buildDataCheckString(params);
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const calculated = crypto
    .createHmac('sha256', secret)
    .update(dataString)
    .digest('hex');
  if (calculated !== hash) {
    throw new Error('Недействительная подпись initData');
  }
  const authDateRaw = params.get('auth_date');
  if (!authDateRaw) {
    throw new Error('auth_date отсутствует');
  }
  const authDate = Number(authDateRaw);
  if (!Number.isFinite(authDate)) {
    throw new Error('Некорректное значение auth_date');
  }
  const expiresIn = options.expiresIn ?? 0;
  if (expiresIn > 0) {
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > expiresIn) {
      throw new Error('initData просрочен');
    }
  }
  return authDate;
}

function parseInitData(params: URLSearchParams, authDate: number): InitDataRecord {
  const result: InitDataRecord = { auth_date: authDate, authDate };
  params.forEach((value, key) => {
    if (key === 'hash') {
      return;
    }
    if (key === 'user' || key === 'receiver' || key === 'chat') {
      try {
        result[key] = JSON.parse(value);
        return;
      } catch {
        result[key] = null;
        return;
      }
    }
    if (key === 'auth_date') {
      return;
    }
    result[key] = value;
  });
  return result;
}

export default function verifyInitData(initData: string) {
  const token = botToken;
  if (!token) {
    throw new Error('BOT_TOKEN не задан');
  }
  const params = new URLSearchParams(initData);
  const authDate = validateSignature(params, token, { expiresIn: 300 });
  return parseInitData(params, authDate);
}

export type InitData = ReturnType<typeof verifyInitData>;
