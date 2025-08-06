#!/usr/bin/env ts-node
/// <reference types="node" />
/* eslint-disable @typescript-eslint/no-var-requires */
// Проверка подключения к MongoDB
import fs from 'fs';
import path from 'path';

try {
  require('dotenv').config();
} catch (e: any) {
  if (e.code === 'MODULE_NOT_FOUND') {
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
    throw e;
  }
}

let mongoose: any;
try {
  mongoose = require('mongoose');
} catch {
  mongoose = require('../bot/node_modules/mongoose');
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

// Выводим домен и имя базы без логина и пароля
try {
  const { hostname, port, pathname } = new URL(url);
  const domain = port ? `${hostname}:${port}` : hostname;
  const dbName = pathname.replace(/^\//, '') || '(по умолчанию)';
  console.log(`Подключение к ${domain}/${dbName}`);
} catch (e: any) {
  console.warn('Не удалось разобрать строку подключения:', e.message);
}

async function main(): Promise<void> {
  async function tryConnect(u: string): Promise<void> {
    await mongoose.connect(u);
    await mongoose.connection.db.admin().ping();
  }

  try {
    await tryConnect(url);
    console.log('MongoDB подключена');
    process.exit(0);
  } catch (e: any) {
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
      } catch (e2: any) {
        console.error('Снова ошибка:', e2.message);
      }
    }
    if (/bad auth/i.test(e.message)) {
      console.error('Проверьте логин и пароль в MONGO_DATABASE_URL');
    }
    process.exit(1);
  }
}

main();
