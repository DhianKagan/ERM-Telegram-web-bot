// Назначение файла: восстановление целостности коллекций департаментов, отделов и должностей.
// Основные модули: mongoose, dotenv, path.
/// <reference path="../../apps/web/src/types/mongodb.d.ts" />
import * as path from 'path';
import type {
  ConnectOptions,
  Schema as MongooseSchema,
  Types as MongooseTypes,
} from 'mongoose';

interface DotenvModule {
  config: (options: { path: string }) => void;
}

const loadDotenv = (): DotenvModule => {
  try {
    return require('dotenv') as DotenvModule;
  } catch {
    return require(
      path.resolve(process.cwd(), 'apps/api/node_modules/dotenv'),
    ) as DotenvModule;
  }
};

const dotenv = loadDotenv();

type MongooseModule = typeof import('mongoose');

const mongoose: MongooseModule = (() => {
  try {
    return require('mongoose');
  } catch {
    return require(path.resolve(process.cwd(), 'apps/api/node_modules/mongoose'));
  }
})();

const { Schema, Types } = mongoose;
type MongoObjectIdCtor = typeof import('mongodb').ObjectId;
const ObjectIdCtor: MongoObjectIdCtor = Types.ObjectId as unknown as MongoObjectIdCtor;

type BulkUpdateOperation<T> = {
  updateOne: {
    filter: Record<string, unknown>;
    update: Record<string, unknown>;
  };
};

type LeanBulkWriteOperation<T> = BulkUpdateOperation<T>;

interface LeanModel<T> {
  find(filter?: Record<string, unknown>): {
    lean(): Promise<T[]>;
    lean<U>(): Promise<U[]>;
  };
  bulkWrite(
    operations: Array<LeanBulkWriteOperation<T>>,
    options?: { ordered?: boolean },
  ): Promise<{ modifiedCount?: number; upsertedCount?: number }>;
  create(doc: Partial<T>): Promise<T & { toObject(): T }>;
}

dotenv.config({ path: path.resolve(__dirname, '../..', '.env') });

const mongoUrl = (
  process.env.MONGO_DATABASE_URL ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  process.env.MONGODB_URL ||
  process.env.DATABASE_URL ||
  ''
).trim();

const TARGET_TYPES = new Set(['departments', 'divisions', 'positions']);
const TYPE_LABELS: Record<string, string> = {
  departments: 'департамент',
  divisions: 'отдел',
  positions: 'должность',
};

type LeanCollectionItem = CollectionItemDoc;

interface ReferenceDoc {
  _id: unknown;
  telegram_id?: number;
  username?: string | null;
  name?: string | null;
  title?: string | null;
  task_number?: string | null;
  departmentId?: unknown;
  divisionId?: unknown;
  positionId?: unknown;
}

interface CollectionItemRecord {
  _id?: MongooseTypes.ObjectId | string;
  type: string;
  name: string;
  value: string;
  meta?: Record<string, unknown>;
}

type CollectionItemDoc = CollectionItemRecord & { _id: MongooseTypes.ObjectId };

const collectionItemSchema = new Schema<CollectionItemDoc>(
  {
    type: { type: String, required: true },
    name: { type: String, required: true },
    value: { type: String, required: true },
    meta: { type: Schema.Types.Mixed, default: undefined },
  },
  { strict: false },
);

interface UserRecord {
  telegram_id?: number;
  username?: string | null;
  name?: string | null;
  departmentId?: MongooseTypes.ObjectId;
  divisionId?: MongooseTypes.ObjectId;
  positionId?: MongooseTypes.ObjectId;
}

type ReferenceDocument = ReferenceDoc & { _id: MongooseTypes.ObjectId };
type UserDoc = ReferenceDocument & UserRecord;

const userSchema = new Schema<UserDoc>(
  {
    telegram_id: Number,
    username: String,
    name: String,
    departmentId: Schema.Types.ObjectId,
    divisionId: Schema.Types.ObjectId,
    positionId: Schema.Types.ObjectId,
  },
  { strict: false },
);

interface TaskRecord {
  title?: string | null;
  task_number?: string | null;
  departmentId?: MongooseTypes.ObjectId;
  divisionId?: MongooseTypes.ObjectId;
  positionId?: MongooseTypes.ObjectId;
}

type TaskDoc = ReferenceDocument & TaskRecord;

const taskSchema = new Schema<TaskDoc>(
  {
    title: String,
    task_number: String,
    departmentId: Schema.Types.ObjectId,
    divisionId: Schema.Types.ObjectId,
    positionId: Schema.Types.ObjectId,
  },
  { strict: false },
);

interface EmployeeRecord {
  name?: string | null;
  departmentId?: MongooseTypes.ObjectId;
  divisionId?: MongooseTypes.ObjectId;
  positionId?: MongooseTypes.ObjectId;
}

type EmployeeDoc = ReferenceDocument & EmployeeRecord;

const employeeSchema = new Schema<EmployeeDoc>(
  {
    name: String,
    departmentId: Schema.Types.ObjectId,
    divisionId: Schema.Types.ObjectId,
    positionId: Schema.Types.ObjectId,
  },
  { strict: false },
);

type RepairCounters = {
  normalized: number;
  restored: number;
  cleared: number;
};

function ensureModel<T>(
  name: string,
  schema: MongooseSchema<T>,
  collection?: string,
): LeanModel<T> {
  const existing = mongoose.models[name] as LeanModel<T> | undefined;
  if (existing) return existing;
  return mongoose.model<T>(name, schema, collection) as LeanModel<T>;
}

const CollectionItem = ensureModel<CollectionItemDoc>(
  'CollectionItem',
  collectionItemSchema,
);
const User = ensureModel<UserDoc>('User', userSchema);
const Task = ensureModel<TaskDoc>('Task', taskSchema);
const Employee = ensureModel<EmployeeDoc>('Employee', employeeSchema);

const toObjectIdHex = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (value instanceof Types.ObjectId) {
    return value.toString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (ObjectIdCtor.isValid(trimmed)) {
      return new ObjectIdCtor(trimmed).toString();
    }
  }
  return undefined;
};

const toObjectId = (value: unknown): MongooseTypes.ObjectId | undefined => {
  if (value instanceof Types.ObjectId) return value as MongooseTypes.ObjectId;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (ObjectIdCtor.isValid(trimmed)) {
      return new ObjectIdCtor(trimmed) as unknown as MongooseTypes.ObjectId;
    }
  }
  return undefined;
};

const cloneMeta = (meta?: Record<string, unknown> | null): Record<string, unknown> | undefined =>
  meta ? { ...meta } : undefined;

const describeContext = (doc: ReferenceDoc, entity: string): string => {
  const parts: string[] = [entity];
  if (entity === 'user' && doc.telegram_id) {
    parts.push(String(doc.telegram_id));
  } else if (entity === 'task' && doc.task_number) {
    parts.push(doc.task_number);
  }
  const label = doc.name || doc.username || doc.title;
  if (label) {
    parts.push(String(label));
  }
  return parts.join(':');
};

const registerItem = (
  store: Map<string, Map<string, CollectionItemDoc>>,
  doc: CollectionItemDoc,
) => {
  if (!TARGET_TYPES.has(doc.type)) return;
  const id = toObjectIdHex(doc._id);
  if (!id) return;
  if (!store.has(doc.type)) {
    store.set(doc.type, new Map());
  }
  const normalized: LeanCollectionItem = {
    _id: doc._id,
    type: doc.type,
    name: doc.name,
    value: doc.value,
    meta: cloneMeta(doc.meta),
  };
  store.get(doc.type)?.set(id, normalized);
};

const normalizeCollectionItems = async (
  store: Map<string, Map<string, CollectionItemDoc>>,
): Promise<number> => {
  const items = await CollectionItem.find({
    type: { $in: Array.from(TARGET_TYPES) },
  }).lean<CollectionItemDoc>();
  const operations: LeanBulkWriteOperation<CollectionItemDoc>[] = [];
  items.forEach((item: CollectionItemDoc) => {
    const id = toObjectIdHex(item._id);
    if (!id) return;
    const trimmedName = typeof item.name === 'string' ? item.name.trim() : '';
    const trimmedValue = typeof item.value === 'string' ? item.value.trim() : '';
    const finalName = trimmedName || `Элемент ${id}`;
    const finalValue = trimmedValue || finalName;
    const set: Record<string, unknown> = {};
    if (item.name !== finalName) {
      set.name = finalName;
    }
    if (item.value !== finalValue) {
      set.value = finalValue;
    }
    if (Object.keys(set).length > 0) {
      operations.push({
        updateOne: {
          filter: { _id: item._id } as Record<string, unknown>,
          update: { $set: set as Record<string, unknown> },
        },
      });
    }
    registerItem(store, { ...item, name: finalName, value: finalValue });
  });
  if (operations.length === 0) return 0;
  const result = await CollectionItem.bulkWrite(operations, { ordered: false });
  return (result.modifiedCount ?? 0) + (result.upsertedCount ?? 0);
};

const ensureCollectionItem = async (
  store: Map<string, Map<string, CollectionItemDoc>>,
  type: string,
  value: unknown,
  context: string,
): Promise<'exists' | 'created' | 'invalid'> => {
  if (!TARGET_TYPES.has(type)) return 'invalid';
  const idHex = toObjectIdHex(value);
  if (!idHex) {
    return 'invalid';
  }
  const existing = store.get(type)?.get(idHex);
  if (existing) {
    return 'exists';
  }
  const objectId = toObjectId(value);
  if (!objectId) {
    return 'invalid';
  }
  const label = TYPE_LABELS[type] ?? 'элемент';
  const name = `Восстановленный ${label} ${idHex}`;
  const meta: Record<string, unknown> = {
    invalid: true,
    invalidCode: 'auto_restored',
    invalidReason:
      'Элемент восстановлен автоматически: проверьте данные и заполните корректные значения.',
    invalidAt: new Date(),
  };
  if (context) {
    meta.restoredFrom = context;
  }
  const created = await CollectionItem.create({
    _id: objectId,
    type,
    name,
    value: idHex,
    meta,
  });
  const lean = created.toObject();
  registerItem(store, lean);
  return 'created';
};

const processReferences = async <T extends ReferenceDocument>(
  store: Map<string, Map<string, CollectionItemDoc>>,
  Model: LeanModel<T>,
  entity: string,
): Promise<{ restored: number; cleared: number }> => {
  const docs = await Model.find().lean<T>();
  if (!docs.length) return { restored: 0, cleared: 0 };
  const updates: LeanBulkWriteOperation<T>[] = [];
  let restored = 0;
  let cleared = 0;
  for (const doc of docs) {
    const unset: Record<string, number> = {};
    const context = describeContext(doc, entity);
    const pairs: [keyof ReferenceDoc, string][] = [
      ['departmentId', 'departments'],
      ['divisionId', 'divisions'],
      ['positionId', 'positions'],
    ];
    for (const [key, type] of pairs) {
      const raw = doc[key];
      if (!raw) continue;
      // eslint-disable-next-line no-await-in-loop
      const outcome = await ensureCollectionItem(store, type, raw, context);
      if (outcome === 'created') {
        restored += 1;
      } else if (outcome === 'invalid') {
        unset[key as string] = 1;
        cleared += 1;
      }
    }
    if (Object.keys(unset).length > 0) {
      updates.push({
        updateOne: {
          filter: { _id: doc._id } as Record<string, unknown>,
          update: { $unset: unset as Record<string, unknown> },
        },
      } as LeanBulkWriteOperation<T>);
    }
  }
  if (updates.length > 0) {
    await Model.bulkWrite(updates, { ordered: false });
  }
  return { restored, cleared };
};

export async function repairCollections(): Promise<RepairCounters> {
  if (!/^mongodb(\+srv)?:\/\//.test(mongoUrl)) {
    console.warn('Не задан MONGO_DATABASE_URL, пропускаем проверку коллекций');
    return { normalized: 0, restored: 0, cleared: 0 };
  }

  let shouldDisconnect = false;
  if (mongoose.connection.readyState !== 1) {
    const connectOptions: ConnectOptions & {
      serverSelectionTimeoutMS?: number;
    } = { serverSelectionTimeoutMS: 5000 };
    await mongoose.connect(mongoUrl, connectOptions);
    shouldDisconnect = true;
  }

  try {
    const store = new Map<string, Map<string, CollectionItemDoc>>();
    const normalized = await normalizeCollectionItems(store);
    const userResult = await processReferences(store, User, 'user');
    const taskResult = await processReferences(store, Task, 'task');
    const employeeResult = await processReferences(store, Employee, 'employee');
    const restored = userResult.restored + taskResult.restored + employeeResult.restored;
    const cleared = userResult.cleared + taskResult.cleared + employeeResult.cleared;
    if (normalized) {
      console.log(`Нормализовано элементов коллекций: ${normalized}`);
    }
    if (restored) {
      console.log(`Восстановлено ссылок на коллекции: ${restored}`);
    }
    if (cleared) {
      console.log(`Удалено битых ссылок: ${cleared}`);
    }
    if (!normalized && !restored && !cleared) {
      console.log('Коллекции уже в корректном состоянии');
    }
    return { normalized, restored, cleared };
  } finally {
    if (shouldDisconnect) {
      await mongoose.disconnect().catch(() => undefined);
    }
  }
}

if (require.main === module) {
  repairCollections()
    .catch((e: unknown) => {
      const err = e as { message?: string };
      console.error('Ошибка восстановления коллекций:', err.message);
      process.exitCode = 1;
    })
    .finally(() => {
      if (!process.exitCode) {
        process.exitCode = 0;
      }
    });
}
