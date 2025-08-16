// Назначение файла: идемпотентное создание индексов задач и загрузок
// Модули: mongoose, dotenv
try {
  require('dotenv/config');
} catch {
  require('../../bot/node_modules/dotenv/config');
}

let mongoose: typeof import('mongoose');
try {
  mongoose = require('mongoose');
} catch {
  mongoose = require('../../bot/node_modules/mongoose');
}

type IndexKey = Record<string, 1 | -1>;

function planKey(key: IndexKey, fields: [string, 1 | -1][]) {
  return fields.every(([f, order]) => key[f] === order);
}

export async function ensureTaskIndexes(conn?: mongoose.Connection) {
  const connection =
    conn ?? (await mongoose.connect(process.env.MONGO_DATABASE_URL!));
  const tasks = connection.db.collection('tasks');
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

export async function ensureUploadIndexes(conn?: mongoose.Connection) {
  const connection =
    conn ?? (await mongoose.connect(process.env.MONGO_DATABASE_URL!));
  await connection.db.createCollection('uploads').catch(() => {});
  const uploads = connection.db.collection('uploads');
  const indexes = (await uploads.indexes()) as { key: IndexKey }[];
  if (!indexes.some((i) => planKey(i.key, [['key', 1]]))) {
    await uploads.createIndex({ key: 1 }, { name: 'key_unique', unique: true });
  }
  if (!indexes.some((i) => planKey(i.key, [['owner', 1]]))) {
    await uploads.createIndex({ owner: 1 }, { name: 'owner_idx' });
  }
  if (!conn) await connection.close();
}

if (require.main === module) {
  ensureTaskIndexes()
    .then(() => ensureUploadIndexes())
    .finally(() => process.exit());
}
