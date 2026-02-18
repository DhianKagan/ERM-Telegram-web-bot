// Назначение: проверка миграции точек маршрута задач.
// Основные модули: mongoose, migrateTaskPoints
import mongoose from 'mongoose';
import { migrateCollection } from '../../../scripts/db/migrateTaskPoints';

jest.setTimeout(30000);

describe('migrateTaskPoints', () => {
  let skipSuite = false;

  beforeAll(async () => {
    try {
      const mongoUrl = process.env.MONGO_DATABASE_URL;
      if (!mongoUrl)
        throw new Error(
          'MONGO_DATABASE_URL не задан для migrateTaskPoints.test',
        );
      await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 5000 });
    } catch (error) {
      skipSuite = true;
      console.warn('MongoDB недоступна, пропускаем migrateTaskPoints.test', {
        error,
      });
    }
  });

  afterAll(async () => {
    if (skipSuite) return;
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    if (skipSuite) return;
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
  });

  test('создаёт points из координат и ссылки маршрута', async () => {
    if (skipSuite) return;
    const collection = mongoose.connection.db.collection('tasks');
    const id = new mongoose.Types.ObjectId();
    await collection.insertOne({
      _id: id,
      startCoordinates: { lat: 1, lng: 2 },
      finishCoordinates: { lat: 3, lng: 4 },
      google_route_url: 'https://maps.test/route',
    });

    const result = await migrateCollection('tasks');
    expect(result.updated).toBe(1);

    const doc = await collection.findOne({ _id: id });
    expect(doc?.points).toEqual([
      {
        order: 0,
        kind: 'start',
        coordinates: { lat: 1, lng: 2 },
        sourceUrl: 'https://maps.test/route',
      },
      {
        order: 1,
        kind: 'finish',
        coordinates: { lat: 3, lng: 4 },
        sourceUrl: 'https://maps.test/route',
      },
    ]);
  });

  test('не изменяет документы с уже заданными points', async () => {
    if (skipSuite) return;
    const collection = mongoose.connection.db.collection('tasks');
    const id = new mongoose.Types.ObjectId();
    await collection.insertOne({
      _id: id,
      points: [
        { order: 0, kind: 'start', coordinates: { lat: 10, lng: 10 } },
        { order: 1, kind: 'finish', coordinates: { lat: 11, lng: 11 } },
      ],
      startCoordinates: { lat: 10, lng: 10 },
      finishCoordinates: { lat: 11, lng: 11 },
    });

    const result = await migrateCollection('tasks');
    expect(result.updated).toBe(0);

    const doc = await collection.findOne({ _id: id });
    expect(doc?.points).toHaveLength(2);
    expect(doc?.points?.[0]?.kind).toBe('start');
  });
});
