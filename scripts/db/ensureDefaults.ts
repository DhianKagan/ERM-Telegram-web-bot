// Назначение: проверка наличия базовых ролей и создание недостающих записей
// Модули: mongoose, Role, config
import mongoose from 'mongoose';
import { Role } from '../../apps/api/src/db/model';
import config from '../../apps/api/src/config';

async function ensureDefaults(): Promise<void> {
  try {
    await mongoose.connect(config.mongoUrl);
  } catch (err) {
    const e = err as Error;
    console.error('Не удалось подключиться к MongoDB:', e.message);
    return;
  }
  const roles = [
    { _id: config.adminRoleId, name: 'admin' },
    { _id: config.managerRoleId, name: 'manager' },
    { _id: config.userRoleId, name: 'user' },
  ];
  for (const r of roles) {
    const exists = await Role.exists({ _id: r._id });
    if (!exists) {
      await Role.create(r);
      console.log(`Добавлена роль ${r.name}`);
    }
  }
  await mongoose.disconnect();
}

if (require.main === module) {
  ensureDefaults().finally(() => process.exit());
}
