// Назначение: проверяет наличие обязательных ролей и создаёт их при отсутствии
// Модули: mongoose, dotenv, path, вспомогательные функции mongoUrl
import * as fs from 'fs'; // модуль для проверки наличия .env
import * as path from 'path'; // модуль для работы с путями
import { createRequire } from 'module'; // модуль для подстановки require относительно workspace
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

const scopedRequireHints = [
  path.resolve(process.cwd(), 'apps/api/package.json'),
  path.resolve(process.cwd(), 'apps/api/tsconfig.json'),
];

const createScopedLoaders = <TModule>(specifier: string): Array<() => TModule> => {
  const loaders: Array<() => TModule> = [
    () => require(specifier) as TModule,
  ];

  for (const hint of scopedRequireHints) {
    try {
      const scopedRequire = createRequire(hint);
      loaders.push(() => scopedRequire(specifier) as TModule);
    } catch {
      continue;
    }
  }

  return loaders;
};

const resolveModule = <TModule>(specifier: string): TModule | null => {
  const loaders = createScopedLoaders<TModule>(specifier);

  for (const load of loaders) {
    try {
      return load();
    } catch {
      continue;
    }
  }

  return null;
};

const loadDotenvModule = (): DotenvModule | null => {
  const moduleInstance = resolveModule<DotenvModule>('dotenv');
  if (!moduleInstance) {
    console.warn('Модуль dotenv не найден, пропускаем загрузку .env');
  }

  return moduleInstance;
};

const dotenv = loadDotenvModule();

const mongoose: MongooseModule = (() => {
  const moduleInstance = resolveModule<MongooseModule>('mongoose');
  if (!moduleInstance) {
    throw new Error(
      'Модуль mongoose не найден. Убедитесь, что зависимости приложения установлены перед запуском ensureDefaults.',
    );
  }

  return moduleInstance;
})();

// Загружаем переменные окружения, не обращаясь к config
const envPath = path.resolve(__dirname, '../..', '.env');
if (dotenv && fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

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
