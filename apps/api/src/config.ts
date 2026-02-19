// Назначение: централизованная загрузка переменных окружения.
// Модули: path, dotenv, process, URL
import path from 'path';
import dotenv from 'dotenv';
import { PROJECT_TIMEZONE } from 'shared';

if (!process.env.TZ) {
  process.env.TZ = PROJECT_TIMEZONE;
}

const isMochaRun = process.argv.some((arg) =>
  /(^|[\\/])mocha(?:\.c?js)?$/i.test(arg),
);
if (!process.env.NODE_ENV && isMochaRun) {
  process.env.NODE_ENV = 'test';
}

const nodeEnv = process.env.NODE_ENV || 'development';
export const isTestEnvironment =
  nodeEnv === 'test' ||
  Boolean(process.env.VITEST_WORKER_ID) ||
  Boolean(process.env.JEST_WORKER_ID) ||
  isMochaRun;
const strictEnvs = new Set(['production', 'production-build']);
const normalizeAppRole = (
  source: string | undefined,
): 'all' | 'api' | 'bot' | 'worker' => {
  const normalized = (source || '').trim().toLowerCase();
  if (normalized === 'api') {
    return 'api';
  }
  if (normalized === 'bot') {
    return 'bot';
  }
  if (normalized === 'worker') {
    return 'worker';
  }
  return 'all';
};
const appRole = normalizeAppRole(process.env.APP_ROLE);
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
const allowMissingEnv =
  parseBooleanFlag(process.env.ALLOW_MISSING_ENV) ||
  Boolean(process.env.RAILWAY_ENVIRONMENT);

// Загружаем .env из корня проекта, чтобы избежать undefined переменных при запуске из каталога bot
dotenv.config({ path: path.resolve(__dirname, '../../..', '.env') });

type EnvPick = { key: string; value: string };

const normalizeEnvValue = (value: string | undefined): string => {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const unquoted = trimmed.replace(/^(['"])(.*)\1$/, '$2').trim();
  return unquoted;
};

const pickFirstFilled = (keys: readonly string[]): EnvPick | undefined => {
  for (const key of keys) {
    const raw = normalizeEnvValue(process.env[key]);
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

const mongoDbNameEnvKeys = [
  'MONGO_DATABASE_NAME',
  'MONGODB_DATABASE',
  'MONGO_DB',
  'MONGODB_DB',
] as const;

const mongoAuthSourceEnvKeys = [
  'MONGO_AUTH_SOURCE',
  'MONGODB_AUTH_SOURCE',
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

const applyMongoDbNameFallback = (target: URL): string | undefined => {
  const dbName = target.pathname.replace(/^\/+/, '');
  if (dbName) {
    return undefined;
  }
  const fallback = pickFirstFilled(mongoDbNameEnvKeys);
  if (!fallback) {
    return undefined;
  }
  target.pathname = `/${fallback.value}`;
  return `именем базы из ${fallback.key}`;
};

const applyMongoAuthSourceFallback = (
  target: URL,
  options: { username: string; isRailwayHost: boolean },
): string | undefined => {
  if (target.searchParams.has('authSource')) {
    return undefined;
  }
  const fallback = pickFirstFilled(mongoAuthSourceEnvKeys);
  if (fallback) {
    target.searchParams.set('authSource', fallback.value);
    return `authSource из ${fallback.key}`;
  }
  if (options.username === 'mongo' && options.isRailwayHost) {
    target.searchParams.set('authSource', 'admin');
    return 'authSource=admin по умолчанию для Railway';
  }
  return undefined;
};

const fallback = {
  BOT_TOKEN: 'test-bot-token',
  CHAT_ID: '0',
  JWT_SECRET: 'test-secret',
  APP_URL: 'https://localhost',
};

const requiredByRole: Record<
  typeof appRole,
  readonly (keyof typeof fallback)[]
> = {
  all: ['BOT_TOKEN', 'CHAT_ID', 'JWT_SECRET', 'APP_URL'],
  api: ['JWT_SECRET', 'APP_URL'],
  bot: ['BOT_TOKEN', 'CHAT_ID', 'APP_URL'],
  worker: ['APP_URL'],
};

const required = requiredByRole[appRole];

for (const key of required) {
  const current = normalizeEnvValue(process.env[key]);
  if (current) {
    process.env[key] = current;
    continue;
  }
  if (isTestEnvironment) {
    process.env[key] = fallback[key];
    continue;
  }
  if (strictEnvs.has(nodeEnv) && !allowMissingEnv) {
    throw new Error(`Переменная ${key} не задана`);
  }
  console.warn(`Переменная ${key} не задана, используем значение по умолчанию`);
  process.env[key] = fallback[key];
}

const mongoUrlEnvRaw = normalizeEnvValue(
  process.env.MONGO_DATABASE_URL ||
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL,
);
const fallbackMongoUrl = 'mongodb://localhost:27017/ermdb';
const mongoUrlEnv = mongoUrlEnvRaw || (allowMissingEnv ? fallbackMongoUrl : '');
if (!/^mongodb(\+srv)?:\/\//.test(mongoUrlEnv)) {
  if (allowMissingEnv) {
    console.warn(
      'MONGO_DATABASE_URL не задан или имеет неверный формат, используем mongodb://localhost:27017/ermdb',
    );
  } else {
    throw new Error(
      'MONGO_DATABASE_URL должен начинаться с mongodb:// или mongodb+srv://',
    );
  }
}

let parsedMongoUrl: URL;
try {
  parsedMongoUrl = new URL(mongoUrlEnv);
} catch {
  if (allowMissingEnv) {
    console.warn(
      'MONGO_DATABASE_URL имеет неверный формат, используем mongodb://localhost:27017/ermdb',
    );
    parsedMongoUrl = new URL(fallbackMongoUrl);
  } else {
    throw new Error('MONGO_DATABASE_URL имеет неверный формат');
  }
}

const fallbackMessages: string[] = [];
const dbFallback = applyMongoDbNameFallback(parsedMongoUrl);
if (dbFallback) {
  fallbackMessages.push(dbFallback);
}

const dbName = parsedMongoUrl.pathname.replace(/^\/+/, '');
if (!dbName) {
  if (allowMissingEnv) {
    parsedMongoUrl.pathname = '/ermdb';
  } else {
    throw new Error(
      'MONGO_DATABASE_URL должен содержать имя базы данных после хоста, например /ermdb',
    );
  }
}

const credentialMessages = applyMongoCredentialFallback(parsedMongoUrl);
if (credentialMessages.length) {
  fallbackMessages.push(...credentialMessages);
}

const isRailwayInternal = /\.railway\.internal$/i.test(parsedMongoUrl.hostname);
const isRailwayProxyHost = /\.proxy\.rlwy\.net$/i.test(parsedMongoUrl.hostname);
const isRailwayAppHost = /\.railway\.app$/i.test(parsedMongoUrl.hostname);
const mongoUsername = decodeURIComponent(parsedMongoUrl.username);
const authFallback = applyMongoAuthSourceFallback(parsedMongoUrl, {
  username: mongoUsername,
  isRailwayHost: isRailwayInternal || isRailwayProxyHost || isRailwayAppHost,
});
if (authFallback) {
  fallbackMessages.push(authFallback);
}

if (fallbackMessages.length) {
  console.log(`MONGO_DATABASE_URL дополнен ${fallbackMessages.join(' и ')}`);
}

const finalMongoUrl = parsedMongoUrl.toString();
process.env.MONGO_DATABASE_URL = finalMongoUrl;

let appUrlEnv = normalizeEnvValue(process.env.APP_URL);
if (!/^https:\/\//.test(appUrlEnv)) {
  if (allowMissingEnv) {
    console.warn(
      'APP_URL не задан или имеет неверный формат, используем https://localhost',
    );
    process.env.APP_URL = fallback.APP_URL;
    appUrlEnv = fallback.APP_URL;
  } else {
    throw new Error(
      'APP_URL должен начинаться с https://, иначе Web App не будет работать',
    );
  }
}

const rawOsrmBase = normalizeEnvValue(
  process.env.OSRM_BASE_URL || process.env.ROUTING_URL,
);
const osrmBaseCandidate = rawOsrmBase || 'http://localhost:5000';

let osrmBaseUrlValue: string;
let routingUrlEnv: string;
try {
  const parsed = new URL(osrmBaseCandidate);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('OSRM_BASE_URL должен начинаться с http:// или https://');
  }
  parsed.search = '';
  parsed.hash = '';
  const normalizedPath = parsed.pathname.replace(/\/+$/, '');
  osrmBaseUrlValue = `${parsed.origin}${normalizedPath}`;
  const hasRouteWithProfile = /\/route\/v\d+\//.test(normalizedPath);
  const routePath = hasRouteWithProfile
    ? normalizedPath
    : normalizedPath.endsWith('/route')
      ? `${normalizedPath}/v1/driving`
      : `${normalizedPath}/route/v1/driving`;
  routingUrlEnv = new URL(routePath, `${parsed.origin}/`).toString();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`OSRM_BASE_URL имеет неверный формат: ${message}`);
}

const graphhopperMatrixUrlRaw = normalizeEnvValue(
  process.env.GRAPHHOPPER_MATRIX_URL,
);
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

const graphhopperApiKeyRaw = normalizeEnvValue(process.env.GRAPHHOPPER_API_KEY);
const graphhopperApiKey = graphhopperApiKeyRaw
  ? graphhopperApiKeyRaw
  : undefined;

const graphhopperProfileRaw = normalizeEnvValue(
  process.env.GRAPHHOPPER_PROFILE,
);
const graphhopperProfile = graphhopperProfileRaw || 'car';

export const graphhopperConfig = {
  matrixUrl: graphhopperMatrixUrl,
  apiKey: graphhopperApiKey,
  profile: graphhopperProfile,
};

const geocoderEnabledFlag = parseBooleanFlag(
  process.env.GEOCODER_ENABLED,
  true,
);
const geocoderBaseUrlRaw =
  normalizeEnvValue(process.env.GEOCODER_URL) ||
  'https://nominatim.openstreetmap.org/search';
let geocoderBaseUrl = geocoderBaseUrlRaw;
if (geocoderBaseUrlRaw) {
  try {
    const parsed = new URL(geocoderBaseUrlRaw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('GEOCODER_URL должен начинаться с http:// или https://');
    }
    geocoderBaseUrl = parsed.toString();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (strictEnvs.has(nodeEnv)) {
      throw new Error(`GEOCODER_URL имеет неверный формат: ${message}`);
    }
    console.warn(
      'Геокодер отключён из-за некорректного GEOCODER_URL:',
      message,
    );
    geocoderBaseUrl = '';
  }
}

const geocoderUserAgentRaw = normalizeEnvValue(process.env.GEOCODER_USER_AGENT);
const geocoderUserAgent = geocoderUserAgentRaw || 'ERM Logistics geocoder';
const geocoderEmailRaw = normalizeEnvValue(process.env.GEOCODER_EMAIL);
const geocoderEmail = geocoderEmailRaw || undefined;
const geocoderEnabled =
  geocoderEnabledFlag && Boolean(geocoderBaseUrl) && !isTestEnvironment;

export const geocoderConfig = {
  enabled: geocoderEnabled,
  baseUrl: geocoderBaseUrl,
  userAgent: geocoderUserAgent,
  email: geocoderEmail,
};

let cookieDomainEnv = normalizeEnvValue(process.env.COOKIE_DOMAIN);
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
const botApiUrlRaw = normalizeEnvValue(process.env.BOT_API_URL);
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

const telegramWebhookUrlRaw = normalizeEnvValue(
  process.env.TELEGRAM_WEBHOOK_URL,
);
let telegramWebhookUrl: string | undefined;
let telegramWebhookPath: string | undefined;
if (telegramWebhookUrlRaw) {
  try {
    const parsed = new URL(telegramWebhookUrlRaw);
    if (parsed.protocol !== 'https:') {
      throw new Error('TELEGRAM_WEBHOOK_URL должен начинаться с https://');
    }
    telegramWebhookUrl = parsed.toString();
    telegramWebhookPath = parsed.pathname || '/';
  } catch (error) {
    console.warn(
      'TELEGRAM_WEBHOOK_URL имеет неверный формат, webhook отключён',
      error,
    );
  }
} else if (strictEnvs.has(nodeEnv)) {
  try {
    const webhookUrl = new URL(appUrlEnv);
    webhookUrl.pathname = '/api/telegram/webhook';
    webhookUrl.search = '';
    webhookUrl.hash = '';
    telegramWebhookUrl = webhookUrl.toString();
    telegramWebhookPath = webhookUrl.pathname || '/';
    console.info(
      'TELEGRAM_WEBHOOK_URL не задан; используется URL по умолчанию для webhook.',
    );
  } catch (error) {
    console.warn(
      'Не удалось сформировать URL для Telegram webhook из APP_URL',
      error,
    );
  }
}

const telegramWebhookSecretValue = normalizeEnvValue(
  process.env.TELEGRAM_WEBHOOK_SECRET,
);

export const botToken = process.env.BOT_TOKEN;
export const botApiUrl = botApiUrlValue;
export { telegramWebhookUrl, telegramWebhookPath };
export const telegramWebhookSecret = telegramWebhookSecretValue || undefined;
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

  const candidate = trimmed.includes(':')
    ? trimmed.slice(trimmed.lastIndexOf(':') + 1)
    : trimmed;
  if (!/^\d+$/.test(candidate)) {
    return undefined;
  }

  const parsed = Number.parseInt(candidate, 10);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    return undefined;
  }
  return parsed;
};

const portFromRailway = parsePort(process.env.RAILWAY_TCP_PORT);
const portFromEnv = parsePort(process.env.PORT);
const portFromHostPort = parsePort(process.env.HOST_PORT);

const selectedPort = portFromEnv ?? portFromRailway ?? portFromHostPort ?? 3000;

if (
  portFromRailway !== undefined &&
  portFromEnv !== undefined &&
  portFromRailway !== portFromEnv
) {
  console.warn(
    `PORT=${portFromEnv} отличается от RAILWAY_TCP_PORT=${portFromRailway}, используем PORT.`,
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
export const osrmBaseUrl = osrmBaseUrlValue;
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
  osrmBaseUrl,
  routingUrl,
  cookieDomain,
  telegramWebhookUrl,
  telegramWebhookPath,
  telegramWebhookSecret,
  vrpOrToolsEnabled,
  graphhopperConfig,
  graphhopper: graphhopperConfig,
  geocoder: geocoderConfig,
};

export default config;
