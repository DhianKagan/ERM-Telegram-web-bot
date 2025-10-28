#!/usr/bin/env ts-node
/**
 * Назначение файла: проверка подключения к MongoDB.
 * Основные модули: dotenv, fs, path, mongoose, вспомогательные функции mongoUrl.
 */

import fs from 'fs';
import path from 'path';
import {
  getMongoUrlFromEnv,
  formatCredentialSources,
} from './db/mongoUrl';

try {
  const dotenv = await import('dotenv');
  dotenv.config();
} catch (e: unknown) {
  const err = e as NodeJS.ErrnoException;
  if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND') {
    console.warn('Модуль dotenv не найден, читаем .env вручную');
    const envPath = path.resolve(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const env = fs.readFileSync(envPath, 'utf8');
      env.split(/\r?\n/).forEach((line) => {
        const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/(^['"]|['"]$)/g, '');
        }
      });
    }
  } else {
    throw err;
  }
}

let mongoose: typeof import('mongoose');
try {
  mongoose = await import('mongoose');
} catch {
  mongoose = await import('../apps/api/node_modules/mongoose');
}

const mongoResolution = getMongoUrlFromEnv();
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

// Выводим домен и имя базы без логина и пароля
try {
  const { hostname, port, pathname } = new URL(url);
  const domain = port ? `${hostname}:${port}` : hostname;
  const dbName = pathname.replace(/^\//, '') || '(по умолчанию)';
  console.log(`Подключение к ${domain}/${dbName}`);
} catch (e: unknown) {
  const err = e as Error;
  console.warn('Не удалось разобрать строку подключения:', err.message);
}

async function main() {
  async function tryConnect(u: string) {
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
  } catch (e: unknown) {
    const err = e as Error;
    console.error('Ошибка подключения к MongoDB:', err.message);
    if (/bad auth/i.test(err.message) && !/authSource/.test(url)) {
      const alt = url.includes('?')
        ? `${url}&authSource=admin`
        : `${url}?authSource=admin`;

      console.log('Повторная попытка с authSource=admin');
      try {
        await mongoose.disconnect();
        await tryConnect(alt);
        console.log('Подключение успешно с authSource=admin');
        process.exit(0);
      } catch (e2: unknown) {
        const err2 = e2 as Error;
        console.error('Снова ошибка:', err2.message);
      }
    }
    if (/bad auth/i.test(err.message)) {
      console.error('Проверьте логин и пароль в MONGO_DATABASE_URL');
    }
    process.exit(1);
  }
}

await main();
