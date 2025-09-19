// Назначение: добавление роли manager в существующую базу данных
// Модули: mongoose, Role, dotenv
import 'dotenv/config';
import mongoose from 'mongoose';
import { Role } from '../../apps/api/src/db/model';

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

async function migrate(): Promise<void> {
  await mongoose.connect(resolveMongoUrl());
  const exists = await Role.exists({ name: 'manager' });
  if (!exists) {
    await Role.create({ name: 'manager' });
    console.log('Роль manager добавлена');
  } else {
    console.log('Роль manager уже существует');
  }
  await mongoose.disconnect();
}

if (require.main === module) {
  migrate().finally(() => process.exit());
}
