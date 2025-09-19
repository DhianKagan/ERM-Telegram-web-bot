// Назначение: синхронизирует поле roleId пользователей с именем роли
// Основные модули: mongoose, User модель, roleCache
import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../../apps/api/src/db/model';
import { resolveRoleId } from '../../apps/api/src/db/roleCache';

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
