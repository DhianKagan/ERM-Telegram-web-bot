// Назначение: синхронизирует поле roleId пользователей с именем роли
// Основные модули: mongoose, User модель, roleCache, вспомогательные функции mongoUrl
import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../../apps/api/src/db/model';
import { resolveRoleId } from '../../apps/api/src/db/roleCache';
import { getMongoUrlFromEnv, formatCredentialSources } from './mongoUrl';

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
  const users = await User.find({ role: { $exists: true } }).select({
    telegram_id: 1,
    role: 1,
    roleId: 1,
  });
  let updated = 0;
  let skipped = 0;
  for (const user of users) {
    const roleName = (user.role || '').trim();
    if (!roleName) continue;
    const roleId = await resolveRoleId(roleName);
    if (!roleId) {
      skipped += 1;
      console.warn(
        `Роль ${roleName} не найдена, пользователь ${user.telegram_id} пропущен`,
      );
      continue;
    }
    if (!user.roleId || user.roleId.toString() !== roleId.toString()) {
      user.roleId = roleId;
      await user.save();
      updated += 1;
    }
  }
  console.log(`Обновлено пользователей: ${updated}`);
  if (skipped) {
    console.log(`Пропущено из-за отсутствия роли: ${skipped}`);
  }
  await mongoose.disconnect();
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((e: unknown) => {
      const err = e as Error;
      console.error('Ошибка миграции:', err.message);
      process.exit(1);
    });
}

export default migrate;
