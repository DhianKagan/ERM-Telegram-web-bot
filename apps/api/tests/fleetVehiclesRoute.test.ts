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
  login: jest.fn(),
  loadTrack: jest.fn(),
}));

import fleetsRouter from '../src/routes/fleets';
import { Fleet } from '../src/db/models/fleet';
import { Vehicle } from '../src/db/models/vehicle';
import { login, loadTrack } from '../src/services/wialon';

jest.setTimeout(30000);

const mockedLogin = login as jest.MockedFunction<typeof login>;
const mockedLoadTrack = loadTrack as jest.MockedFunction<typeof loadTrack>;

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
    mockedLogin.mockReset();
    mockedLoadTrack.mockReset();
  });

  it('возвращает список транспорта без трека', async () => {
    const fleet = await Fleet.create({ name: 'Флот', token: 'token' });
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
    const fleet = await Fleet.create({ name: 'Флот', token: 'token' });
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

    expect(mockedLogin).toHaveBeenCalledWith('token');
    expect(res.body.vehicles[0].track).toHaveLength(1);
    expect(res.body.vehicles[0].track[0]).toMatchObject({
      lat: 55,
      lon: 37,
    });
  });
});
