// Назначение файла: проверка подключения к MongoDB.
// Основные модули: dotenv, fs, path, mongoose.

import fs from 'fs';
import path from 'path';

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

const url = (
  process.env.MONGO_DATABASE_URL ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL ||
  ''
).trim();

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
