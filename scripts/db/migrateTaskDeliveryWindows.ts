// Миграция MongoDB: синхронизация окон доставки между полями задачи и логистикой
// Основные модули: mongoose, dotenv, модели проекта
import mongoose from 'mongoose';
import 'dotenv/config';
import '../../apps/api/src/db/model';

type LogisticsDetailsDoc = {
  start_date?: unknown;
  end_date?: unknown;
};

type TaskDoc = {
  _id: mongoose.Types.ObjectId;
  logistics_details?: LogisticsDetailsDoc | null;
  delivery_window_start?: unknown;
  delivery_window_end?: unknown;
};

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

async function syncCollection(name: string): Promise<number> {
  const collection = mongoose.connection.db.collection<TaskDoc>(name);
  const cursor = collection.find({
    $or: [
      { 'logistics_details.start_date': { $exists: true } },
      { 'logistics_details.end_date': { $exists: true } },
      { delivery_window_start: { $exists: true } },
      { delivery_window_end: { $exists: true } },
    ],
  });

  let updated = 0;
  for await (const doc of cursor) {
    const set: Record<string, unknown> = {};

    const logisticStart = toDate(doc.logistics_details?.start_date);
    const logisticEnd = toDate(doc.logistics_details?.end_date);
    const windowStart = toDate(doc.delivery_window_start);
    const windowEnd = toDate(doc.delivery_window_end);

    if (logisticStart && !windowStart) {
      set.delivery_window_start = logisticStart;
    }
    if (logisticEnd && !windowEnd) {
      set.delivery_window_end = logisticEnd;
    }
    if (windowStart && !logisticStart) {
      set['logistics_details.start_date'] = windowStart;
    }
    if (windowEnd && !logisticEnd) {
      set['logistics_details.end_date'] = windowEnd;
    }

    if (Object.keys(set).length === 0) {
      continue;
    }

    await collection.updateOne({ _id: doc._id }, { $set: set });
    updated += 1;
  }

  return updated;
}

const collections = ['tasks', 'archives'];

(async () => {
  try {
    const results = await Promise.all(collections.map((name) => syncCollection(name)));
    results.forEach((count, index) => {
      console.log(`Коллекция ${collections[index]}: обновлено документов ${count}`);
    });
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Миграция окон доставки завершилась с ошибкой', error);
    await mongoose.disconnect();
    process.exit(1);
  }
})();
