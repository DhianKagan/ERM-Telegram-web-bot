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

const mongoUrlSources = [
  { key: 'MONGO_DATABASE_URL', value: process.env.MONGO_DATABASE_URL },
  { key: 'MONGO_URL', value: process.env.MONGO_URL },
  { key: 'MONGODB_URL', value: process.env.MONGODB_URL },
  { key: 'MONGO_PUBLIC_URL', value: process.env.MONGO_PUBLIC_URL },
  { key: 'MONGODB_URI', value: process.env.MONGODB_URI },
  { key: 'DATABASE_URL', value: process.env.DATABASE_URL },
] as const;

const selectedMongoSource = mongoUrlSources.find((item) =>
  Boolean(item.value && item.value.trim()),
);

const mongoUrlSourceKey = selectedMongoSource?.key ?? 'MONGO_DATABASE_URL';
let mongoUrlEnv = (selectedMongoSource?.value || '').trim();

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

const mongoUsername = decodeURIComponent(parsedMongoUrl.username);
const isRailwayInternal = /\.railway\.internal$/i.test(parsedMongoUrl.hostname);

let dbName = parsedMongoUrl.pathname.replace(/^\/+/, '');
if (!dbName) {
  const dbFromEnv = (process.env.MONGO_DATABASE_NAME || '').trim();
  const fallbackDb = dbFromEnv || (mongoUrlSourceKey === 'MONGO_DATABASE_URL' ? '' : 'ermdb');
  if (!fallbackDb) {
    throw new Error(
      'MONGO_DATABASE_URL должен содержать имя базы данных после хоста, например /ermdb',
    );
  }
  parsedMongoUrl.pathname = `/${fallbackDb}`;
  dbName = fallbackDb;
}

let authSource = parsedMongoUrl.searchParams.get('authSource');
const authSourceFromEnv = (process.env.MONGO_AUTH_SOURCE || '').trim();
if (!authSource && authSourceFromEnv) {
  parsedMongoUrl.searchParams.set('authSource', authSourceFromEnv);
  authSource = authSourceFromEnv;
}
if (!authSource && isRailwayInternal && mongoUsername === 'mongo') {
  parsedMongoUrl.searchParams.set('authSource', 'admin');
  authSource = 'admin';
}
if (!authSource && isRailwayInternal && mongoUsername === 'mongo') {
  throw new Error(
    'Для MongoDB Railway добавьте параметр authSource=admin в MONGO_DATABASE_URL',
  );
}

mongoUrlEnv = parsedMongoUrl.toString();
process.env.MONGO_DATABASE_URL = mongoUrlEnv;

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

const graphhopperMatrixUrlEnv = (process.env.GRAPHHOPPER_MATRIX_URL || '').trim();
let graphhopperMatrixUrl: string | undefined;
if (graphhopperMatrixUrlEnv) {
  let parsed: URL;
  try {
    parsed = new URL(graphhopperMatrixUrlEnv);
  } catch {
    throw new Error('GRAPHHOPPER_MATRIX_URL имеет неверный формат');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('GRAPHHOPPER_MATRIX_URL должен начинаться с https://');
  }
  graphhopperMatrixUrl = parsed.toString();
}

const graphhopperApiKeyEnv = (process.env.GRAPHHOPPER_API_KEY || '').trim();
const graphhopperProfileEnv = (process.env.GRAPHHOPPER_PROFILE || '').trim();

const parseBooleanFlag = (
  source: string | undefined,
  defaultValue = false,
): boolean => {
  if (source === undefined) {
    return defaultValue;
  }
  const normalized = source.trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

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
export const vrpOrToolsEnabled = parseBooleanFlag(
  process.env.VRP_ORTOOLS_ENABLED,
  false,
);

const parsePort = (source: string | undefined | null): number | undefined => {
  if (!source) {
    return undefined;
  }
  const trimmed = source.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    return undefined;
  }
  return parsed;
};

const portFromRailway = parsePort(process.env.RAILWAY_TCP_PORT);
const portFromEnv = parsePort(process.env.PORT);
const portFromHostPort = parsePort(process.env.HOST_PORT);

const selectedPort =
  portFromRailway ?? portFromEnv ?? portFromHostPort ?? 3000;

if (
  portFromRailway !== undefined &&
  portFromEnv !== undefined &&
  portFromRailway !== portFromEnv
) {
  console.warn(
    `Railway принудительно использует порт ${portFromRailway}, игнорируем PORT=${portFromEnv}.`,
  );
}

if (
  portFromHostPort !== undefined &&
  (portFromRailway !== undefined || portFromEnv !== portFromHostPort)
) {
  console.warn(
    `HOST_PORT=${portFromHostPort} не используется веб-сервером, используем порт ${selectedPort}.`,
  );
}

// Приводим порт к числу для корректной передачи в listen
export const port = selectedPort;
export const locale = process.env.LOCALE || 'ru';
export const routingUrl = routingUrlEnv;
export const graphhopperConfig = {
  matrixUrl: graphhopperMatrixUrl,
  apiKey: graphhopperApiKeyEnv ? graphhopperApiKeyEnv : undefined,
  profile: graphhopperProfileEnv || 'car',
};
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
  graphhopper: graphhopperConfig,
  cookieDomain,
  vrpOrToolsEnabled,
};

export default config;
