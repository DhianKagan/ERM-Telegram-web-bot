// Назначение: проверяет наличие обязательных ролей и создаёт их при отсутствии
// Модули: mongoose, Role, config
let mongoose: typeof import('mongoose');
try {
  mongoose = require('mongoose');
} catch {
  mongoose = require('../../apps/api/node_modules/mongoose');
}
import { Role } from '../../apps/api/src/db/model';
import config from '../../apps/api/src/config';

async function ensureDefaults(): Promise<void> {
  const timeout = 5000;
  try {
    await mongoose.connect(config.mongoUrl, {
      serverSelectionTimeoutMS: timeout,
    });
    const db = mongoose.connection.db;
    if (!db) throw new Error('нет доступа к db');
    await db.admin().ping();
  } catch (e) {
    const err = e as { message?: string };
    console.warn(
      'Не удалось подключиться к MongoDB, пропускаем инициализацию:',
      err.message,
    );
    await mongoose.disconnect().catch(() => undefined);
    return;
  }

  const ids: Record<string, string> = {
    ADMIN_ROLE_ID: config.adminRoleId,
    USER_ROLE_ID: config.userRoleId,
    MANAGER_ROLE_ID: config.managerRoleId,
  };
  for (const [key, value] of Object.entries(ids)) {
    if (!process.env[key]) {
      console.warn(
        `Переменная ${key} не задана, используем значение по умолчанию ${value}`,
      );
    }
  }

  const roles = [
    { _id: config.userRoleId, name: 'user' },
    { _id: config.adminRoleId, name: 'admin' },
    { _id: config.managerRoleId, name: 'manager' },
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
  ensureDefaults()
    .catch((e: unknown) => {
      const err = e as { message?: string };
      console.error('Ошибка инициализации:', err.message);
    })
    .finally(() => process.exit());
}

export default ensureDefaults;
