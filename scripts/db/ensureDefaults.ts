// Назначение: проверяет наличие обязательных ролей и создаёт их при отсутствии
// Модули: mongoose, dotenv, path
import * as path from 'path'; // модуль для работы с путями

const dotenv: any = (() => {
  try {
    return require('dotenv');
  } catch {
    return require('../../apps/api/node_modules/dotenv');
  }
})();

const mongoose: any = (() => {
  try {
    return require('mongoose');
  } catch {
    return require('../../apps/api/node_modules/mongoose');
  }
})();

// Загружаем переменные окружения, не обращаясь к config
dotenv.config({ path: path.resolve(__dirname, '../..', '.env') });

const mongoUrl = (
  process.env.MONGO_DATABASE_URL ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL ||
  ''
).trim();
if (!/^mongodb(\+srv)?:\/\//.test(mongoUrl)) {
  throw new Error(
    'MONGO_DATABASE_URL должен начинаться с mongodb:// или mongodb+srv://',
  );
}

const adminRoleId = process.env.ADMIN_ROLE_ID || '686591126cc86a6bd16c18af';
const userRoleId = process.env.USER_ROLE_ID || '686633fdf6896f1ad3fa063e';
const managerRoleId = process.env.MANAGER_ROLE_ID || '686633fdf6896f1ad3fa063f';

const roleSchema = new mongoose.Schema({
  name: String,
  permissions: [String],
});
const Role = mongoose.model('Role', roleSchema);

async function ensureDefaults(): Promise<void> {
  const timeout = 5000;
  try {
    await mongoose.connect(mongoUrl, {
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
    ADMIN_ROLE_ID: adminRoleId,
    USER_ROLE_ID: userRoleId,
    MANAGER_ROLE_ID: managerRoleId,
  };
  for (const [key, value] of Object.entries(ids)) {
    if (!process.env[key]) {
      console.warn(
        `Переменная ${key} не задана, используем значение по умолчанию ${value}`,
      );
    }
  }

  const roles = [
    { _id: userRoleId, name: 'user' },
    { _id: adminRoleId, name: 'admin' },
    { _id: managerRoleId, name: 'manager' },
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
