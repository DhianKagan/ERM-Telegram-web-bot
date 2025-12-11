// Миграция MongoDB: заполнение поля points из start/finish координат и google_route_url.
// Основные модули: mongoose, dotenv, модели проекта
import mongoose from 'mongoose';
import 'dotenv/config';
import '../../apps/api/src/db/model';
import { parsePointInput } from '../../apps/api/src/utils/geo';

type TaskDoc = {
  _id: mongoose.Types.ObjectId;
  startCoordinates?: unknown;
  finishCoordinates?: unknown;
  google_route_url?: unknown;
  points?: unknown;
};

type MigrationResult = {
  collection: string;
  updated: number;
};

const normalizeCoords = (
  value: unknown,
): { lat: number; lng: number } | undefined =>
  parsePointInput(value) ?? undefined;

const normalizeUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const buildPoints = (doc: TaskDoc) => {
  const points: Array<{
    order: number;
    kind: 'start' | 'finish';
    coordinates: { lat: number; lng: number };
    sourceUrl?: string;
  }> = [];

  const start = normalizeCoords(doc.startCoordinates);
  const finish = normalizeCoords(doc.finishCoordinates);
  const sourceUrl = normalizeUrl(doc.google_route_url);

  if (start) {
    points.push({
      order: points.length,
      kind: 'start',
      coordinates: start,
      sourceUrl,
    });
  }

  if (finish) {
    points.push({
      order: points.length,
      kind: 'finish',
      coordinates: finish,
      sourceUrl,
    });
  }

  return points;
};

const hasPoints = (value: unknown): boolean =>
  Array.isArray(value) && value.length > 0;

export async function migrateCollection(
  name: string,
): Promise<MigrationResult> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Подключение MongoDB недоступно');
  }
  const collection = db.collection<TaskDoc>(name);
  const cursor = collection.find({
    $and: [
      {
        $or: [
          { points: { $exists: false } },
          { points: null },
          { points: { $size: 0 } },
        ],
      },
      {
        $or: [
          { startCoordinates: { $exists: true } },
          { finishCoordinates: { $exists: true } },
          { google_route_url: { $exists: true } },
        ],
      },
    ],
  });

  let updated = 0;
  for await (const doc of cursor) {
    if (hasPoints(doc.points)) {
      continue;
    }
    const points = buildPoints(doc);
    if (!points.length) {
      continue;
    }
    const set: Record<string, unknown> = { points };
    const start = normalizeCoords(doc.startCoordinates);
    const finish = normalizeCoords(doc.finishCoordinates);
    if (start) set.startCoordinates = start;
    if (finish) set.finishCoordinates = finish;
    await collection.updateOne({ _id: doc._id }, { $set: set });
    updated += 1;
  }

  return { collection: name, updated };
}

export async function migrateTaskPoints(): Promise<MigrationResult[]> {
  const collections = ['tasks', 'archives'];
  const results: MigrationResult[] = [];
  for (const name of collections) {
    const res = await migrateCollection(name);
    results.push(res);
  }
  return results;
}

async function run() {
  try {
    const results = await migrateTaskPoints();
    results.forEach((res) => {
      console.log(
        `Коллекция ${res.collection}: обновлено документов ${res.updated}`,
      );
    });
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Миграция points завершилась с ошибкой', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  void run();
}
