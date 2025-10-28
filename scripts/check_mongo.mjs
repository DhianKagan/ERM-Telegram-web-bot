// Назначение файла: проверка подключения к MongoDB.
// Основные модули: dotenv, fs, path, mongoose, вспомогательные функции mongoUrl.

import fs from 'fs';
import path from 'path';

const URL_ENV_KEYS = [
  'MONGO_DATABASE_URL',
  'MONGODB_URI',
  'MONGO_URL',
  'MONGODB_URL',
  'DATABASE_URL',
];
const USERNAME_ENV_KEYS = [
  'MONGO_USERNAME',
  'MONGODB_USERNAME',
  'MONGO_USER',
  'MONGODB_USER',
  'MONGO_INITDB_ROOT_USERNAME',
];
const PASSWORD_ENV_KEYS = [
  'MONGO_PASSWORD',
  'MONGODB_PASSWORD',
  'MONGO_PASS',
  'MONGODB_PASS',
  'MONGO_INITDB_ROOT_PASSWORD',
];

function pickFirstFilled(keys) {
  for (const key of keys) {
    const raw = process.env[key];
    if (!raw) continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    return { key, value: trimmed };
  }
  return undefined;
}

function applyMongoCredentialFallback(rawUrl) {
  if (!rawUrl) {
    return { url: rawUrl };
  }
  try {
    const parsed = new URL(rawUrl);
    let usernameSource;
    let passwordSource;

    if (!parsed.username) {
      const fallback = pickFirstFilled(USERNAME_ENV_KEYS);
      if (fallback) {
        parsed.username = fallback.value;
        usernameSource = fallback.key;
      }
    }

    if (!parsed.password) {
      const fallback = pickFirstFilled(PASSWORD_ENV_KEYS);
      if (fallback) {
        parsed.password = fallback.value;
        passwordSource = fallback.key;
      }
    }

    return {
      url: parsed.toString(),
      usernameSource,
      passwordSource,
    };
  } catch {
    return { url: rawUrl };
  }
}

function formatCredentialSources({ usernameSource, passwordSource }) {
  const parts = [];
  if (usernameSource) {
    parts.push(`логином из ${usernameSource}`);
  }
  if (passwordSource) {
    parts.push(`паролем из ${passwordSource}`);
  }
  if (!parts.length) {
    return undefined;
  }
  return `MONGO_DATABASE_URL дополнен ${parts.join(' и ')}`;
}

if (process.env.CI) {
  console.log('CI: пропускаем проверку MongoDB');
  process.exit(0);
}

function readEnv(file) {
  if (!fs.existsSync(file)) return;
  const env = fs.readFileSync(file, 'utf8');
  env.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/(^['"]|['"]$)/g, '');
    }
  });
}

try {
  const dotenv = await import('dotenv');
  dotenv.config();
} catch (e) {
  if (e.code === 'ERR_MODULE_NOT_FOUND' || e.code === 'MODULE_NOT_FOUND') {
    console.warn('Модуль dotenv не найден, читаем .env вручную');
    const envPath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      '..',
      '.env',
    );
    readEnv(envPath);
  } else {
    throw e;
  }
}

if (
  !process.env.MONGO_DATABASE_URL &&
  !process.env.MONGODB_URI &&
  !process.env.MONGO_URL &&
  !process.env.MONGODB_URL &&
  !process.env.DATABASE_URL
) {
  const examplePath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    '.env.example',
  );
  readEnv(examplePath);
}

let mongoose;
try {
  mongoose = await import('mongoose');
} catch {
  mongoose = await import('../apps/api/node_modules/mongoose/index.js');
}

const envPick = pickFirstFilled(URL_ENV_KEYS);
const rawUrl = envPick ? envPick.value : '';
const mongoResolution = applyMongoCredentialFallback(rawUrl.trim());
process.env.MONGO_DATABASE_URL = mongoResolution.url;
const url = mongoResolution.url;
const credentialsNote = formatCredentialSources(mongoResolution);
if (credentialsNote) {
  console.log(credentialsNote);
}

if (!url) {
  console.error('Не задан MONGO_DATABASE_URL');
  process.exit(1);
}
if (!/mongodb(?:\+srv)?:\/\/.+:.+@/.test(url)) {
  console.warn(
    'Строка подключения не содержит логин и пароль, проверка может завершиться ошибкой',
  );
}

try {
  const { hostname, port, pathname } = new URL(url);
  const domain = port ? `${hostname}:${port}` : hostname;
  const dbName = pathname.replace(/^\//, '') || '(по умолчанию)';
  console.log(`Подключение к ${domain}/${dbName}`);
} catch (e) {
  console.warn('Не удалось разобрать строку подключения:', e.message);
}

async function main() {
  async function tryConnect(u) {
    const conn = await mongoose.connect(u);
    const db = conn.connection && conn.connection.db;
    if (!db) {
      throw new Error('База данных недоступна');
    }
    await db.admin().ping();
  }

  try {
    await tryConnect(url);
    console.log('MongoDB подключена');
    process.exit(0);
  } catch (e) {
    console.error('Ошибка подключения к MongoDB:', e.message);
    if (/bad auth/i.test(e.message) && !/authSource/.test(url)) {
      const alt = url.includes('?')
        ? `${url}&authSource=admin`
        : `${url}?authSource=admin`;
      console.log('Повторная попытка с authSource=admin');
      try {
        await mongoose.disconnect();
        await tryConnect(alt);
        console.log('Подключение успешно с authSource=admin');
        process.exit(0);
      } catch (e2) {
        console.error('Снова ошибка:', e2.message);
      }
    }
    if (/bad auth/i.test(e.message)) {
      console.error('Проверьте логин и пароль в MONGO_DATABASE_URL');
    }
    process.exit(1);
  }
}

await main();
