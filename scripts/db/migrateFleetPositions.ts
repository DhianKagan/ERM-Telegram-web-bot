// Миграция MongoDB: нормализует координаты транспорта в коллекции fleets
// Основные модули: mongoose, dotenv, модель приложения
import mongoose from 'mongoose';
import 'dotenv/config';
import '../../apps/api/src/db/model';

type PositionDocument = {
  lat?: unknown;
  lon?: unknown;
  timestamp?: unknown;
} | null;

type FleetDocument = {
  _id: mongoose.Types.ObjectId;
  position?: PositionDocument;
};

const toNumber = (value: unknown, min: number, max: number): number | null => {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
    return null;
  }
  if (parsed < min || parsed > max) {
    return null;
  }
  return parsed;
};

const normalizePosition = (position: PositionDocument): PositionDocument => {
  if (!position || typeof position !== 'object') {
    return null;
  }
  const lat = toNumber(position.lat, -90, 90);
  const lon = toNumber(position.lon, -180, 180);
  if (lat === null || lon === null) {
    return null;
  }
  const timestampValue = position.timestamp;
  const timestamp =
    timestampValue === undefined || timestampValue === null
      ? undefined
      : timestampValue instanceof Date
        ? timestampValue
        : new Date(String(timestampValue));
  if (timestamp !== undefined && Number.isNaN(timestamp.getTime())) {
    return { lat, lon };
  }
  return timestamp ? { lat, lon, timestamp } : { lat, lon };
};

const positionsEqual = (
  current: PositionDocument,
  next: PositionDocument,
): boolean => {
  if (!current && !next) {
    return true;
  }
  if (!current || !next) {
    return false;
  }
  const sameLat = toNumber(current.lat, -90, 90) === next.lat;
  const sameLon = toNumber(current.lon, -180, 180) === next.lon;
  const currentTimestamp = current.timestamp
    ? new Date(String(current.timestamp))
    : null;
  const nextTimestamp = next.timestamp
    ? new Date(String(next.timestamp))
    : null;
  const sameTimestamp =
    (currentTimestamp === null && nextTimestamp === null) ||
    (currentTimestamp !== null &&
      nextTimestamp !== null &&
      currentTimestamp.getTime() === nextTimestamp.getTime());
  return sameLat && sameLon && sameTimestamp;
};

(async () => {
  try {
    const collection =
      mongoose.connection.db.collection<FleetDocument>('fleets');
    const cursor = collection.find({});
    let updated = 0;

    for await (const doc of cursor) {
      const normalized = normalizePosition(doc.position ?? null);
      if (positionsEqual(doc.position ?? null, normalized)) {
        continue;
      }
      await collection.updateOne(
        { _id: doc._id },
        { $set: { position: normalized } },
      );
      updated += 1;
    }

    console.log(`Обновлено записей автопарка: ${updated}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Миграция координат автопарка завершилась с ошибкой', error);
    await mongoose.disconnect();
    process.exit(1);
  }
})();
