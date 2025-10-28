// Назначение: добавление роли manager в существующую базу данных
// Модули: mongoose, Role, dotenv, вспомогательные функции mongoUrl
import 'dotenv/config';
import mongoose from 'mongoose';
import { Role } from '../../apps/api/src/db/model';
import {
  getMongoUrlFromEnv,
  formatCredentialSources,
} from './mongoUrl';

function resolveMongoUrl(): string {
  const resolution = getMongoUrlFromEnv();
  if (!/^mongodb(\+srv)?:\/\//.test(resolution.url)) {
    throw new Error('Не задана строка подключения к MongoDB');
  }
  const note = formatCredentialSources(resolution);
  if (note) {
    console.log(note);
  }
  return resolution.url;
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
