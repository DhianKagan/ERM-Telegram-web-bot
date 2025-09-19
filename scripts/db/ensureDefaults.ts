// Назначение: проверяет наличие обязательных ролей и создаёт их при отсутствии
// Модули: mongoose, dotenv, path
import * as path from 'path'; // модуль для работы с путями

const dotenv: any = (() => {
  try {
    return require('dotenv');
  } catch {
    return require(path.resolve(process.cwd(), 'apps/api/node_modules/dotenv'));
  }
})();

const mongoose: any = (() => {
  try {
    return require('mongoose');
  } catch {
    return require(
      path.resolve(process.cwd(), 'apps/api/node_modules/mongoose'),
    );
  }
})();

// Загружаем переменные окружения, не обращаясь к config
dotenv.config({ path: path.resolve(__dirname, '../..', '.env') });

const mongoUrl = (
  process.env.MONGO_DATABASE_URL ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  process.env.MONGODB_URL ||
  process.env.DATABASE_URL ||
  ''
).trim();

const roleSchema = new mongoose.Schema({
  name: String,
  permissions: [String],
});
const Role = mongoose.model('Role', roleSchema);

async function ensureDefaults(): Promise<void> {
  if (!/^mongodb(\+srv)?:\/\//.test(mongoUrl)) {
    console.warn('Не задан MONGO_DATABASE_URL, пропускаем инициализацию');
    return;
  }

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

  const roleNames = ['user', 'admin', 'manager'];

  for (const name of roleNames) {
    const res = await Role.updateOne(
      { name },
      { $setOnInsert: { name } },
      { upsert: true },
    );
    if (res.upsertedCount) {
      console.log(`Добавлена роль ${name}`);
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
