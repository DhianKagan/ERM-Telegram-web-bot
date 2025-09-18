// Назначение: проверка REST-роута получения транспорта флота
// Основные модули: express, supertest, mongodb-memory-server
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../src/middleware/auth', () => ({
  __esModule: true,
  default: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next(),
}));

jest.mock('../src/auth/roles.guard', () => ({
  __esModule: true,
  default: (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next(),
}));

jest.mock('../src/auth/roles.decorator', () => ({
  __esModule: true,
  Roles: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next(),
}));

jest.mock('../src/services/wialon', () => ({
  __esModule: true,
  DEFAULT_BASE_URL: 'https://hst-api.wialon.com',
  decodeLocatorKey: (value: string) => {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (normalized.length % 4)) % 4;
    const buffer = Buffer.from(normalized.padEnd(normalized.length + padding, '='), 'base64');
    if (!buffer.length) {
      throw new Error('Не удалось расшифровать ключ локатора');
    }
    const decoded = buffer.toString('utf8');
    if (!decoded.trim() || !/^[\x20-\x7E]+$/.test(decoded)) {
      throw new Error('Расшифрованный ключ содержит недопустимые символы');
    }
    return decoded;
  },
  parseLocatorLink: (link: string) => {
    const url = new URL(link);
    const key = url.searchParams.get('t');
    if (!key) {
      throw new Error('Нет ключа локатора');
    }
    const normalized = key.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (normalized.length % 4)) % 4;
    const token = Buffer.from(normalized.padEnd(normalized.length + padding, '='), 'base64').toString('utf8');
    return {
      locatorUrl: url.toString(),
      baseUrl: 'https://hst-api.wialon.com',
      locatorKey: key,
      token,
    };
  },
  login: jest.fn(),
  loadTrack: jest.fn(),
}));

jest.mock('../src/services/fleetVehicles', () => ({
  __esModule: true,
  syncFleetVehicles: jest.fn(),
  syncAllFleets: jest.fn(),
}));

import fleetsRouter from '../src/routes/fleets';
import { Fleet } from '../src/db/models/fleet';
import { CollectionItem } from '../src/db/models/CollectionItem';
import { Vehicle } from '../src/db/models/vehicle';
import { login, loadTrack } from '../src/services/wialon';
import { syncFleetVehicles } from '../src/services/fleetVehicles';

jest.setTimeout(60000);

const mockedLogin = login as jest.MockedFunction<typeof login>;
const mockedLoadTrack = loadTrack as jest.MockedFunction<typeof loadTrack>;
const mockedSyncFleetVehicles = syncFleetVehicles as jest.MockedFunction<
  typeof syncFleetVehicles
>;

describe('GET /api/v1/fleets/:id/vehicles', () => {
  let mongod: MongoMemoryServer;
  let app: express.Express;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    app = express();
    app.use('/api/v1/fleets', fleetsRouter);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  beforeEach(async () => {
    await Fleet.deleteMany({});
    await Vehicle.deleteMany({});
    await CollectionItem.deleteMany({});
    mockedLogin.mockReset();
    mockedLoadTrack.mockReset();
    mockedSyncFleetVehicles.mockReset();
    mockedSyncFleetVehicles.mockResolvedValue();
  });

  it('возвращает список транспорта без трека', async () => {
    const fleet = await Fleet.create({
      name: 'Флот',
      token: 'token',
      locatorUrl: 'https://hosting.wialon.com/locator?t=dG9rZW4=',
      baseUrl: 'https://hst-api.wialon.com',
      locatorKey: 'dG9rZW4=',
    });
    await Vehicle.create({
      fleetId: fleet._id,
      unitId: 1,
      name: 'Экскаватор',
      position: { lat: 55.1, lon: 37.2, speed: 10 },
      sensors: [{ name: 'Температура', value: 20 }],
    });

    const res = await request(app)
      .get(`/api/v1/fleets/${fleet._id.toString()}/vehicles`)
      .expect(200);

    expect(res.body.fleet.name).toBe('Флот');
    expect(res.body.vehicles).toHaveLength(1);
    expect(res.body.vehicles[0]).toMatchObject({
      unitId: 1,
      name: 'Экскаватор',
      sensors: [{ name: 'Температура', value: 20 }],
    });
  });

  it('подставляет трек при запросе', async () => {
    const fleet = await Fleet.create({
      name: 'Флот',
      token: 'token',
      locatorUrl: 'https://hosting.wialon.com/locator?t=dG9rZW4=',
      baseUrl: 'https://hst-api.wialon.com',
      locatorKey: 'dG9rZW4=',
    });
    await Vehicle.create({
      fleetId: fleet._id,
      unitId: 7,
      name: 'Погрузчик',
      sensors: [],
    });
    const from = new Date('2024-01-01T00:00:00.000Z');
    const to = new Date('2024-01-01T01:00:00.000Z');
    mockedLogin.mockResolvedValue({ sid: 'sid', eid: 'eid', user: { id: 1 } });
    mockedLoadTrack.mockResolvedValue([
      { lat: 55, lon: 37, speed: 15, course: 90, timestamp: from },
    ]);

    const res = await request(app)
      .get(
        `/api/v1/fleets/${fleet._id.toString()}/vehicles?track=1&from=${from.toISOString()}&to=${to.toISOString()}`,
      )
      .expect(200);

    expect(mockedLogin).toHaveBeenCalledWith('token', 'https://hst-api.wialon.com');
    expect(res.body.vehicles[0].track).toHaveLength(1);
    expect(res.body.vehicles[0].track[0]).toMatchObject({
      lat: 55,
      lon: 37,
    });
  });

  it('восстанавливает флот из коллекции, если запись отсутствует', async () => {
    const id = new mongoose.Types.ObjectId();
    await CollectionItem.create({
      _id: id,
      type: 'fleets',
      name: 'Автопарк',
      value: 'https://hosting.wialon.com/locator?t=dG9rZW4=',
    });
    mockedSyncFleetVehicles.mockResolvedValue();

    const res = await request(app)
      .get(`/api/v1/fleets/${id.toString()}/vehicles`)
      .expect(200);

    expect(res.body.fleet).toMatchObject({ name: 'Автопарк' });
    const fleet = await Fleet.findById(id);
    expect(fleet).not.toBeNull();
    expect(mockedSyncFleetVehicles).toHaveBeenCalledTimes(1);
  });

  it('восстанавливает флот из коллекции с устаревшим значением', async () => {
    const id = new mongoose.Types.ObjectId();
    const legacyPayload = {
      token: 'legacy-token',
      baseUrl: 'https://hst-api.wialon.com',
    };
    await CollectionItem.create({
      _id: id,
      type: 'fleets',
      name: 'Наследие',
      value: JSON.stringify(legacyPayload),
    });

    const res = await request(app)
      .get(`/api/v1/fleets/${id.toString()}/vehicles`)
      .expect(200);

    expect(res.body.fleet).toMatchObject({ name: 'Наследие' });
    const fleet = await Fleet.findById(id);
    expect(fleet).not.toBeNull();
    expect(fleet?.token).toBe('legacy-token');
    const expectedKey = Buffer.from('legacy-token', 'utf8').toString('base64');
    expect(fleet?.locatorKey).toBe(expectedKey);
    expect(fleet?.locatorUrl).toContain(expectedKey);
    const item = await CollectionItem.findById(id);
    expect(item?.value).toBe(fleet?.locatorUrl);
    expect(mockedSyncFleetVehicles).toHaveBeenCalledTimes(1);
  });

  it('обновляет устаревший токен до ссылки локатора', async () => {
    const id = new mongoose.Types.ObjectId();
    await CollectionItem.create({
      _id: id,
      type: 'fleets',
      name: 'Сырые данные',
      value: 'raw-token',
    });

    await request(app)
      .get(`/api/v1/fleets/${id.toString()}/vehicles`)
      .expect(200);

    const fleet = await Fleet.findById(id);
    expect(fleet).not.toBeNull();
    expect(fleet?.token).toBe('raw-token');
    const expectedKey = Buffer.from('raw-token', 'utf8').toString('base64');
    expect(fleet?.locatorKey).toBe(expectedKey);
    const item = await CollectionItem.findById(id);
    expect(item?.value).toBe(
      `https://hosting.wialon.com/locator?t=${encodeURIComponent(expectedKey)}`,
    );
    expect(mockedSyncFleetVehicles).toHaveBeenCalledTimes(1);
  });

  it('вызывает синхронизацию при создании флота', async () => {
    const res = await request(app)
      .post('/api/v1/fleets')
      .send({ name: 'Новый флот', link: 'https://hosting.wialon.com/locator?t=dG9rZW4=' })
      .expect(201);
    expect(res.body.name).toBe('Новый флот');
    expect(mockedSyncFleetVehicles).toHaveBeenCalledTimes(1);
  });

  it('вызывает синхронизацию при обновлении флота', async () => {
    const fleet = await Fleet.create({
      name: 'Флот',
      token: 'token',
      locatorUrl: 'https://hosting.wialon.com/locator?t=dG9rZW4=',
      baseUrl: 'https://hst-api.wialon.com',
      locatorKey: 'dG9rZW4=',
    });
    mockedSyncFleetVehicles.mockClear();
    await request(app)
      .put(`/api/v1/fleets/${fleet._id.toString()}`)
      .send({ name: 'Флот 2' })
      .expect(200);
    expect(mockedSyncFleetVehicles).toHaveBeenCalledTimes(1);
  });

  it('обновляет транспорт через PATCH', async () => {
    const fleet = await Fleet.create({
      name: 'Флот',
      token: 'token',
      locatorUrl: 'https://hosting.wialon.com/locator?t=dG9rZW4=',
      baseUrl: 'https://hst-api.wialon.com',
      locatorKey: 'dG9rZW4=',
    });
    const vehicle = await Vehicle.create({
      fleetId: fleet._id,
      unitId: 55,
      name: 'Самосвал',
      sensors: [],
    });

    const response = await request(app)
      .patch(`/api/v1/fleets/${fleet._id.toString()}/vehicles/${vehicle._id.toString()}`)
      .send({
        name: 'Каток',
        notes: 'Готов к выезду',
        customSensors: [{ name: 'Лампочка', value: true }],
      })
      .expect(200);

    expect(response.body.name).toBe('Каток');
    expect(response.body.notes).toBe('Готов к выезду');
    expect(response.body.customSensors).toHaveLength(1);
    const stored = await Vehicle.findById(vehicle._id).lean();
    expect(stored?.notes).toBe('Готов к выезду');
    expect(stored?.customSensors).toHaveLength(1);
  });

  it('перезаписывает транспорт через PUT', async () => {
    const fleet = await Fleet.create({
      name: 'Флот',
      token: 'token',
      locatorUrl: 'https://hosting.wialon.com/locator?t=dG9rZW4=',
      baseUrl: 'https://hst-api.wialon.com',
      locatorKey: 'dG9rZW4=',
    });
    const vehicle = await Vehicle.create({
      fleetId: fleet._id,
      unitId: 77,
      name: 'Кран',
      notes: 'Замечания',
      sensors: [],
      customSensors: [{ name: 'Сирена', value: 'ok' }],
    });

    const response = await request(app)
      .put(`/api/v1/fleets/${fleet._id.toString()}/vehicles/${vehicle._id.toString()}`)
      .send({ name: 'Кран-2' })
      .expect(200);

    expect(response.body.name).toBe('Кран-2');
    expect(response.body.notes).toBe('');
    expect(Array.isArray(response.body.customSensors)).toBe(true);
    expect(response.body.customSensors).toHaveLength(0);
    const stored = await Vehicle.findById(vehicle._id).lean();
    expect(stored?.notes).toBe('');
    expect(stored?.customSensors).toHaveLength(0);
  });
});
