// Назначение: проверяет наличие обязательных ролей и создаёт их при отсутствии
// Модули: mongoose, dotenv, path, вспомогательные функции mongoUrl
import * as path from 'path'; // модуль для работы с путями
import {
  getMongoUrlFromEnv,
  formatCredentialSources,
} from './mongoUrl';

interface ConnectOptions {
  serverSelectionTimeoutMS?: number;
}

type MongooseSchema<TRecord> = unknown;

interface MongooseModel<TRecord> {
  updateOne(
    filter: Partial<TRecord>,
    update: Record<string, unknown>,
    options: { upsert: boolean },
  ): Promise<{ upsertedCount: number }>;
}

interface MongooseModule {
  Schema: new <TRecord>(
    definition: Record<string, unknown>,
  ) => MongooseSchema<TRecord>;
  model<TRecord>(name: string, schema: MongooseSchema<TRecord>): MongooseModel<TRecord>;
  connect(uri: string, options: ConnectOptions): Promise<void>;
  disconnect(): Promise<void>;
  connection: {
    db?: {
      admin(): {
        ping(): Promise<void>;
      };
    };
  };
}

interface DotenvModule {
  config: (options?: { path?: string }) => void;
}

const dotenv: DotenvModule = (() => {
  try {
    return require('dotenv') as DotenvModule;
  } catch {
    return require(path.resolve(process.cwd(), 'apps/api/node_modules/dotenv')) as DotenvModule;
  }
})();

const mongoose: MongooseModule = (() => {
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

const mongoResolution = getMongoUrlFromEnv();
const mongoUrl = mongoResolution.url;
const credentialsNote = formatCredentialSources(mongoResolution);
if (credentialsNote) {
  console.log(credentialsNote);
}

interface RoleRecord {
  name?: string;
  permissions?: string[];
}

const roleSchema = new mongoose.Schema<RoleRecord>({
  name: String,
  permissions: [String],
});
const Role = mongoose.model<RoleRecord>('Role', roleSchema);

async function ensureDefaults(): Promise<void> {
  if (!/^mongodb(\+srv)?:\/\//.test(mongoUrl)) {
    console.warn('Не задан MONGO_DATABASE_URL, пропускаем инициализацию');
    return;
  }

  const timeout = 5000;
  const connectOptions: ConnectOptions & {
    serverSelectionTimeoutMS?: number;
  } = {
    serverSelectionTimeoutMS: timeout,
  };
  try {
    await mongoose.connect(mongoUrl, connectOptions);
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
