// Назначение: вспомогательные функции для сборки строки подключения MongoDB из переменных окружения.
// Основные модули: process, url

export type MongoUrlResolution = {
  url: string;
  usernameSource?: string;
  passwordSource?: string;
  messages?: string[];
};

const URL_ENV_KEYS = [
  'MONGO_DATABASE_URL',
  'MONGODB_URI',
  'MONGO_URL',
  'MONGODB_URL',
  'DATABASE_URL',
] as const;

const USERNAME_ENV_KEYS = [
  'MONGO_USERNAME',
  'MONGODB_USERNAME',
  'MONGO_USER',
  'MONGODB_USER',
  'MONGO_INITDB_ROOT_USERNAME',
] as const;

const PASSWORD_ENV_KEYS = [
  'MONGO_PASSWORD',
  'MONGODB_PASSWORD',
  'MONGO_PASS',
  'MONGODB_PASS',
  'MONGO_INITDB_ROOT_PASSWORD',
] as const;

const DB_NAME_ENV_KEYS = [
  'MONGO_DATABASE_NAME',
  'MONGODB_DATABASE',
  'MONGO_DB',
  'MONGODB_DB',
] as const;

const AUTH_SOURCE_ENV_KEYS = [
  'MONGO_AUTH_SOURCE',
  'MONGODB_AUTH_SOURCE',
] as const;

type EnvPick = { key: string; value: string };

function pickFirstFilled(keys: readonly string[]): EnvPick | undefined {
  for (const key of keys) {
    const raw = process.env[key];
    if (!raw) continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    return { key, value: trimmed };
  }
  return undefined;
}

export function applyMongoCredentialFallback(
  rawUrl: string,
): MongoUrlResolution {
  if (!rawUrl) {
    return { url: rawUrl };
  }
  try {
    const parsed = new URL(rawUrl);
    let usernameSource: string | undefined;
    let passwordSource: string | undefined;
    const messages: string[] = [];

    if (!parsed.username) {
      const fallback = pickFirstFilled(USERNAME_ENV_KEYS);
      if (fallback) {
        parsed.username = fallback.value;
        usernameSource = fallback.key;
        messages.push(`логином из ${fallback.key}`);
      }
    }

    if (!parsed.password) {
      const fallback = pickFirstFilled(PASSWORD_ENV_KEYS);
      if (fallback) {
        parsed.password = fallback.value;
        passwordSource = fallback.key;
        messages.push(`паролем из ${fallback.key}`);
      }
    }

    const dbName = parsed.pathname.replace(/^\/+/, '');
    if (!dbName) {
      const fallback = pickFirstFilled(DB_NAME_ENV_KEYS);
      if (fallback) {
        parsed.pathname = `/${fallback.value}`;
        messages.push(`именем базы из ${fallback.key}`);
      }
    }

    if (!parsed.searchParams.has('authSource')) {
      const authFallback = pickFirstFilled(AUTH_SOURCE_ENV_KEYS);
      if (authFallback) {
        parsed.searchParams.set('authSource', authFallback.value);
        messages.push(`authSource из ${authFallback.key}`);
      } else {
        const username = decodeURIComponent(parsed.username);
        const hostname = parsed.hostname;
        const isRailwayInternal = /\.railway\.internal$/i.test(hostname);
        const isRailwayProxyHost = /\.proxy\.rlwy\.net$/i.test(hostname);
        const isRailwayAppHost = /\.railway\.app$/i.test(hostname);
        if (
          username === 'mongo' &&
          (isRailwayInternal || isRailwayProxyHost || isRailwayAppHost)
        ) {
          parsed.searchParams.set('authSource', 'admin');
          messages.push('authSource=admin по умолчанию для Railway');
        }
      }
    }

    return {
      url: parsed.toString(),
      usernameSource,
      passwordSource,
      messages: messages.length ? messages : undefined,
    };
  } catch {
    return { url: rawUrl };
  }
}

export function getMongoUrlFromEnv(): MongoUrlResolution & {
  sourceKey?: string;
} {
  const envPick = pickFirstFilled(URL_ENV_KEYS);
  const rawUrl = envPick ? envPick.value : '';
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { url: '' };
  }
  const resolved = applyMongoCredentialFallback(trimmed);
  process.env.MONGO_DATABASE_URL = resolved.url;
  return {
    ...resolved,
    sourceKey: envPick?.key,
  };
}

export function formatCredentialSources({
  usernameSource,
  passwordSource,
  messages,
}: MongoUrlResolution): string | undefined {
  const parts: string[] = messages ? [...messages] : [];
  if (!parts.length) {
    if (usernameSource) {
      parts.push(`логином из ${usernameSource}`);
    }
    if (passwordSource) {
      parts.push(`паролем из ${passwordSource}`);
    }
  }
  if (!parts.length) {
    return undefined;
  }
  const tail = parts.join(' и ');
  return `MONGO_DATABASE_URL дополнен ${tail}`;
}
