// Назначение файла: идемпотентное создание индексов задач и загрузок
// Модули: mongoose, dotenv
import type { Connection } from 'mongoose';

try {
  require('dotenv/config');
} catch {
  require('../../apps/api/node_modules/dotenv/config');
}

let mongoose: typeof import('mongoose');
try {
  mongoose = require('mongoose');
} catch {
  mongoose = require('../../apps/api/node_modules/mongoose');
}

type IndexKey = Record<string, 1 | -1>;

function planKey(key: IndexKey, fields: [string, 1 | -1][]) {
  return fields.every(([f, order]) => key[f] === order);
}

const getDatabase = (connection: Connection) => {
  const db = connection.db;
  if (!db) {
    throw new Error('Соединение MongoDB не содержит доступной базы данных');
  }
  return db;
};

export async function ensureTaskIndexes(conn?: Connection) {
  const connection: Connection =
    conn ?? (await mongoose.connect(process.env.MONGO_DATABASE_URL!)).connection;
  const tasks = getDatabase(connection).collection('tasks');
  const indexes = (await tasks.indexes()) as { key: IndexKey }[];

  if (
    !indexes.some((i) =>
      planKey(i.key, [
        ['assigneeId', 1],
        ['status', 1],
        ['dueAt', 1],
      ]),
    )
  ) {
    await tasks.createIndex(
      { assigneeId: 1, status: 1, dueAt: 1 },
      { name: 'assignee_status_dueAt' },
    );
  }
  if (!indexes.some((i) => planKey(i.key, [['createdAt', -1]]))) {
    await tasks.createIndex({ createdAt: -1 }, { name: 'createdAt_desc' });
  }

  if (!conn) await connection.close();
}

export async function ensureUploadIndexes(conn?: Connection) {
  const connection: Connection =
    conn ?? (await mongoose.connect(process.env.MONGO_DATABASE_URL!)).connection;
  const uploadDb = getDatabase(connection);
  await uploadDb.createCollection('uploads').catch(() => {});
  const uploads = uploadDb.collection('uploads');
  const indexes = (await uploads.indexes()) as { key: IndexKey }[];
  if (!indexes.some((i) => planKey(i.key, [['key', 1]]))) {
    await uploads.createIndex({ key: 1 }, { name: 'key_unique', unique: true });
  }
  if (!indexes.some((i) => planKey(i.key, [['owner', 1]]))) {
    await uploads.createIndex({ owner: 1 }, { name: 'owner_idx' });
  }
  if (!conn) await connection.close();
}

export async function ensureCollectionItemIndexes(conn?: Connection) {
  const connection: Connection =
    conn ?? (await mongoose.connect(process.env.MONGO_DATABASE_URL!)).connection;
  const collectionDb = getDatabase(connection);
  await collectionDb.createCollection('collectionitems').catch(() => {});
  const items = collectionDb.collection('collectionitems');
  const indexes = (await items.indexes()) as {
    key: Record<string, unknown>;
    name?: string;
  }[];
  if (
    !indexes.some((i) =>
      planKey(i.key as IndexKey, [
        ['type', 1],
        ['name', 1],
      ]),
    )
  ) {
    await items.createIndex(
      { type: 1, name: 1 },
      { name: 'type_name_unique', unique: true },
    );
  }
  const hasText = indexes.some(
    (i) =>
      i.key.type === 'text' && i.key.name === 'text' && i.key.value === 'text',
  );
  if (!hasText) {
    await items.createIndex(
      { type: 'text', name: 'text', value: 'text' },
      { name: 'search_text' },
    );
  }
  if (!conn) await connection.close();
}

if (require.main === module) {
  ensureTaskIndexes()
    .then(() => ensureUploadIndexes())
    .then(() => ensureCollectionItemIndexes())
    .finally(() => process.exit());
}
