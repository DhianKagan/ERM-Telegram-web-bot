// Назначение файла: идемпотентное создание индексов задач
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

function planKey(key: Record<string, number>, fields: [string, number][]) {
  return fields.every(([f, order]) => key[f] === order);
}

export async function ensureTaskIndexes(conn?: mongoose.Connection) {
  const connection = conn ?? (await mongoose.connect(process.env.MONGO_DATABASE_URL!));
  const tasks = connection.db.collection('tasks');
  const indexes = await tasks.indexes();

  if (!indexes.some((i) => planKey(i.key as any, [ ['assigneeId', 1], ['status', 1], ['dueAt', 1] ]))) {
    await tasks.createIndex({ assigneeId: 1, status: 1, dueAt: 1 }, { name: 'assignee_status_dueAt' });
  }
  if (!indexes.some((i) => planKey(i.key as any, [['createdAt', -1]]))) {
    await tasks.createIndex({ createdAt: -1 }, { name: 'createdAt_desc' });
  }

  if (!conn) await connection.close();
}

if (require.main === module) {
  ensureTaskIndexes().finally(() => process.exit());
}
