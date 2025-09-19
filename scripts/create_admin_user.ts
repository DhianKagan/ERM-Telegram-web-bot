#!/usr/bin/env node
// Назначение файла: скрипт создания администратора по Telegram ID
// Модули: mongoose, dotenv, модели проекта, roleCache

import dotenv from 'dotenv';
dotenv.config();

let mongoose: typeof import('mongoose');
try {
  mongoose = require('mongoose');
} catch {
  mongoose = require('../apps/api/node_modules/mongoose');
}

import { User } from '../apps/api/src/db/model';
import { resolveRoleId } from '../apps/api/src/db/roleCache';

const [, , idArg, usernameArg] = process.argv;
if (!idArg) {
  console.log(
    'Использование: node scripts/create_admin_user.ts <telegram_id> [username]',
  );
  process.exit(1);
}
const telegramId = Number(idArg);
const username = usernameArg || `admin_${telegramId}`;

function resolveMongoUrl(): string {
  const url =
    process.env.MONGO_DATABASE_URL ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URL ||
    process.env.MONGODB_URL ||
    process.env.DATABASE_URL ||
    '';
  if (!/^mongodb(\+srv)?:\/\//.test(url)) {
    throw new Error('Не задана строка подключения к MongoDB');
  }
  return url;
}

async function main(): Promise<void> {
  try {
    await mongoose.connect(resolveMongoUrl());
  } catch (e: unknown) {
    const err = e as Error;
    console.error('Ошибка подключения к MongoDB:', err.message);
    process.exit(1);
  }
  const adminRoleId = await resolveRoleId('admin');
  if (!adminRoleId) {
    throw new Error('Роль admin не найдена');
  }
  let user = await User.findOne({ telegram_id: telegramId });
  if (!user) {
    user = await User.create({
      telegram_id: telegramId,
      username,
      email: `${telegramId}@telegram.local`,
      role: 'admin',
      roleId: adminRoleId,
      access: 2,
    });
  } else {
    user.role = 'admin';
    user.roleId = adminRoleId;
    user.access = 2;
    user.username = username;
    await user.save();
  }
  console.log('Администратор создан:', user.telegram_id);
  await mongoose.disconnect();
}

main().catch((e: unknown) => {
  const err = e as Error;
  console.error('Ошибка:', err.message);
  process.exit(1);
});
