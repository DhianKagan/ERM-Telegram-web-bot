// Назначение: централизованная загрузка переменных окружения.
// Модули: path, dotenv, process
import path from 'path';
import dotenv from 'dotenv';
import { PROJECT_TIMEZONE } from 'shared';

if (!process.env.TZ) {
  process.env.TZ = PROJECT_TIMEZONE;
}

const isMochaRun = process.argv.some((arg) => /(^|[\\/])mocha(?:\.c?js)?$/i.test(arg));
if (!process.env.NODE_ENV && isMochaRun) {
  process.env.NODE_ENV = 'test';
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isTestEnvironment =
  nodeEnv === 'test' ||
  Boolean(process.env.VITEST_WORKER_ID) ||
  Boolean(process.env.JEST_WORKER_ID) ||
  isMochaRun;
const strictEnvs = new Set(['production', 'production-build']);

// Загружаем .env из корня проекта, чтобы избежать undefined переменных при запуске из каталога bot
dotenv.config({ path: path.resolve(__dirname, '../..', '.env') });

const required = ['BOT_TOKEN', 'CHAT_ID', 'JWT_SECRET', 'APP_URL'] as const;
const fallback: Record<(typeof required)[number], string> = {
  BOT_TOKEN: 'test-bot-token',
  CHAT_ID: '0',
  JWT_SECRET: 'test-secret',
  APP_URL: 'https://localhost',
};

for (const key of required) {
  const current = (process.env[key] || '').trim();
  if (current) {
    continue;
  }
  if (strictEnvs.has(nodeEnv)) {
    throw new Error(`Переменная ${key} не задана`);
  }
  if (isTestEnvironment) {
    process.env[key] = fallback[key];
  } else {
    throw new Error(`Переменная ${key} не задана`);
  }
}

const mongoUrlEnv = (
  process.env.MONGO_DATABASE_URL ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL ||
  ''
).trim();
if (!/^mongodb(\+srv)?:\/\//.test(mongoUrlEnv)) {
  throw new Error(
    'MONGO_DATABASE_URL должен начинаться с mongodb:// или mongodb+srv://',
  );
}

let parsedMongoUrl: URL;
try {
  parsedMongoUrl = new URL(mongoUrlEnv);
} catch {
  throw new Error('MONGO_DATABASE_URL имеет неверный формат');
}

const dbName = parsedMongoUrl.pathname.replace(/^\/+/, '');
if (!dbName) {
  throw new Error(
    'MONGO_DATABASE_URL должен содержать имя базы данных после хоста, например /ermdb',
  );
}

const authSource = parsedMongoUrl.searchParams.get('authSource');
const mongoUsername = decodeURIComponent(parsedMongoUrl.username);
const isRailwayInternal = /\.railway\.internal$/i.test(parsedMongoUrl.hostname);
if (!authSource && isRailwayInternal && mongoUsername === 'mongo') {
  throw new Error(
    'Для MongoDB Railway добавьте параметр authSource=admin в MONGO_DATABASE_URL',
  );
}

const appUrlEnv = (process.env.APP_URL || '').trim();
if (!/^https:\/\//.test(appUrlEnv)) {
  throw new Error(
    'APP_URL должен начинаться с https://, иначе Web App не будет работать',
  );
}

const routingUrlEnv = (
  process.env.ROUTING_URL || 'https://localhost:8000/route'
).trim();
if (!/^https:\/\//.test(routingUrlEnv)) {
  throw new Error('ROUTING_URL должен начинаться с https://');
}

let cookieDomainEnv = (process.env.COOKIE_DOMAIN || '').trim();
if (cookieDomainEnv) {
  if (/^https?:\/\//.test(cookieDomainEnv)) {
    try {
      cookieDomainEnv = new URL(cookieDomainEnv).hostname;
    } catch {
      throw new Error('COOKIE_DOMAIN имеет неверный формат');
    }
  }
  const domainReg =
    /^([.]?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
  if (!domainReg.test(cookieDomainEnv)) {
    throw new Error('COOKIE_DOMAIN имеет неверный формат');
  }
}

const botApiUrlBlockedHosts = new Set([
  'github.com',
  'www.github.com',
  'raw.githubusercontent.com',
  'gist.github.com',
]);

let botApiUrlValue: string | undefined;
const botApiUrlRaw = (process.env.BOT_API_URL || '').trim();
if (botApiUrlRaw) {
  try {
    const parsed = new URL(botApiUrlRaw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('BOT_API_URL должен начинаться с http:// или https://');
    }
    if (botApiUrlBlockedHosts.has(parsed.hostname)) {
      console.warn(
        `BOT_API_URL указывает на неподдерживаемый хост (${parsed.hostname}), используем https://api.telegram.org`,
      );
    } else {
      botApiUrlValue = botApiUrlRaw.replace(/\/+$/, '');
    }
  } catch (error) {
    console.warn(
      'BOT_API_URL имеет неверный формат, используем значение по умолчанию',
      error,
    );
  }
}

export const botToken = process.env.BOT_TOKEN;
export const botApiUrl = botApiUrlValue;
export const getChatId = (): string | undefined => {
  const raw = process.env.CHAT_ID;
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
};
export const chatId = getChatId();
export const jwtSecret = process.env.JWT_SECRET;
export const mongoUrl = mongoUrlEnv;
export const appUrl = appUrlEnv;
// Приводим порт к числу для корректной передачи в listen
export const port = Number.parseInt(process.env.PORT ?? '', 10) || 3000;
export const locale = process.env.LOCALE || 'ru';
export const routingUrl = routingUrlEnv;
export const cookieDomain = cookieDomainEnv;
const config = {
  botToken,
  botApiUrl,
  get chatId() {
    return getChatId();
  },
  jwtSecret,
  mongoUrl,
  appUrl,
  port,
  locale,
  routingUrl,
  cookieDomain,
};

export default config;
