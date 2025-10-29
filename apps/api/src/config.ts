// Назначение: централизованная загрузка переменных окружения.
// Модули: path, dotenv, process, URL
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

type EnvPick = { key: string; value: string };

const pickFirstFilled = (keys: readonly string[]): EnvPick | undefined => {
  for (const key of keys) {
    const raw = process.env[key];
    if (!raw) {
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    return { key, value: trimmed };
  }
  return undefined;
};

const mongoUsernameEnvKeys = [
  'MONGO_USERNAME',
  'MONGODB_USERNAME',
  'MONGO_USER',
  'MONGODB_USER',
  'MONGO_INITDB_ROOT_USERNAME',
] as const;

const mongoPasswordEnvKeys = [
  'MONGO_PASSWORD',
  'MONGODB_PASSWORD',
  'MONGO_PASS',
  'MONGODB_PASS',
  'MONGO_INITDB_ROOT_PASSWORD',
] as const;

const applyMongoCredentialFallback = (target: URL): string[] => {
  const messages: string[] = [];
  if (!target.username) {
    const fallback = pickFirstFilled(mongoUsernameEnvKeys);
    if (fallback) {
      target.username = fallback.value;
      messages.push(`логином из ${fallback.key}`);
    }
  }
  if (!target.password) {
    const fallback = pickFirstFilled(mongoPasswordEnvKeys);
    if (fallback) {
      target.password = fallback.value;
      messages.push(`паролем из ${fallback.key}`);
    }
  }
  return messages;
};

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

const credentialMessages = applyMongoCredentialFallback(parsedMongoUrl);
if (credentialMessages.length) {
  console.log(`MONGO_DATABASE_URL дополнен ${credentialMessages.join(' и ')}`);
}

const authSource = parsedMongoUrl.searchParams.get('authSource');
const mongoUsername = decodeURIComponent(parsedMongoUrl.username);
const isRailwayInternal = /\.railway\.internal$/i.test(parsedMongoUrl.hostname);
const isRailwayProxyHost = /\.proxy\.rlwy\.net$/i.test(parsedMongoUrl.hostname);
const isRailwayAppHost = /\.railway\.app$/i.test(parsedMongoUrl.hostname);
const requiresRailwayAuthSource =
  !authSource &&
  mongoUsername === 'mongo' &&
  (isRailwayInternal || isRailwayProxyHost || isRailwayAppHost);
if (requiresRailwayAuthSource) {
  throw new Error(
    'Для MongoDB Railway добавьте параметр authSource=admin в MONGO_DATABASE_URL',
  );
}

const finalMongoUrl = parsedMongoUrl.toString();
process.env.MONGO_DATABASE_URL = finalMongoUrl;

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

const graphhopperMatrixUrlRaw = (process.env.GRAPHHOPPER_MATRIX_URL || '').trim();
let graphhopperMatrixUrl: string | undefined;
if (graphhopperMatrixUrlRaw) {
  try {
    const parsed = new URL(graphhopperMatrixUrlRaw);
    if (parsed.protocol !== 'https:') {
      throw new Error('GRAPHHOPPER_MATRIX_URL должен начинаться с https://');
    }
    graphhopperMatrixUrl = parsed.toString();
  } catch (error) {
    if (strictEnvs.has(nodeEnv)) {
      throw new Error('GRAPHHOPPER_MATRIX_URL имеет неверный формат');
    }
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(
      'GRAPHHOPPER_MATRIX_URL имеет неверный формат, GraphHopper отключён:',
      reason,
    );
    graphhopperMatrixUrl = undefined;
  }
}

const graphhopperApiKeyRaw = (process.env.GRAPHHOPPER_API_KEY || '').trim();
const graphhopperApiKey = graphhopperApiKeyRaw ? graphhopperApiKeyRaw : undefined;

const graphhopperProfileRaw = (process.env.GRAPHHOPPER_PROFILE || '').trim();
const graphhopperProfile = graphhopperProfileRaw || 'car';

export const graphhopperConfig = {
  matrixUrl: graphhopperMatrixUrl,
  apiKey: graphhopperApiKey,
  profile: graphhopperProfile,
};

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
export const mongoUrl = finalMongoUrl;
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
  vrpOrToolsEnabled,
  graphhopperConfig,
  graphhopper: graphhopperConfig,
};

export default config;
