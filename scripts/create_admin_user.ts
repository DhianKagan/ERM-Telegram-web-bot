#!/usr/bin/env node
// Назначение файла: скрипт создания администратора по Telegram ID
// Модули: mongoose, dotenv, модели проекта

import dotenv from 'dotenv';
dotenv.config();

let mongoose: typeof import('mongoose');
try {
  mongoose = require('mongoose');
} catch {
  mongoose = require('../bot/node_modules/mongoose');
}

import { User } from '../bot/src/db/model';
import config from '../bot/src/config';

const [, , idArg, usernameArg] = process.argv;
if (!idArg) {
  console.log(
    'Использование: node scripts/create_admin_user.ts <telegram_id> [username]',
  );
  process.exit(1);
}
const telegramId = Number(idArg);
const username = usernameArg || `admin_${telegramId}`;

async function main(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGO_DATABASE_URL as string);
  } catch (e: unknown) {
    const err = e as Error;
    console.error('Ошибка подключения к MongoDB:', err.message);
    process.exit(1);
  }
  let user = await User.findOne({ telegram_id: telegramId });
  if (!user) {
    user = await User.create({
      telegram_id: telegramId,
      username,
      email: `${telegramId}@telegram.local`,
      role: 'admin',
      roleId: config.adminRoleId,
      access: 2,
    });
  } else {
    user.role = 'admin';
    user.roleId = config.adminRoleId;
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
