// Миграция MongoDB: разделение идентификаторов сообщений задач в Telegram
// Основные модули: mongoose, dotenv, модели проекта
import mongoose from 'mongoose';
import 'dotenv/config';
import '../../apps/api/src/db/model';

type TaskDoc = {
  _id: mongoose.Types.ObjectId;
  telegram_status_message_id?: unknown;
  telegram_history_message_id?: unknown;
};

const tasks = mongoose.connection.db.collection<TaskDoc>('tasks');

const cursor = tasks.find(
  {
    $or: [
      { telegram_status_message_id: { $exists: true } },
      { telegram_history_message_id: { $exists: true } },
    ],
  },
  {
    projection: {
      telegram_status_message_id: 1,
      telegram_history_message_id: 1,
    },
  },
);

let updated = 0;

for await (const doc of cursor) {
  const statusId = doc.telegram_status_message_id;
  const historyId = doc.telegram_history_message_id;
  const set: Record<string, unknown> = {};
  const unset: Record<string, ''> = {};
  const hasStatusField = Object.prototype.hasOwnProperty.call(
    doc,
    'telegram_status_message_id',
  );
  const statusNumber =
    typeof statusId === 'number' && Number.isFinite(statusId) ? statusId : null;
  const historyNumber =
    typeof historyId === 'number' && Number.isFinite(historyId)
      ? historyId
      : null;
  if (statusNumber !== null && historyNumber === null) {
    set.telegram_history_message_id = statusNumber;
  }
  if (hasStatusField) {
    unset.telegram_status_message_id = '';
  }
  if (!Object.keys(set).length && !Object.keys(unset).length) {
    continue;
  }
  const update: Record<string, unknown> = {};
  if (Object.keys(set).length) {
    update.$set = set;
  }
  if (Object.keys(unset).length) {
    update.$unset = unset;
  }
  await tasks.updateOne({ _id: doc._id }, update);
  updated += 1;
}

console.log(`Обновлено задач: ${updated}`);
process.exit(0);
