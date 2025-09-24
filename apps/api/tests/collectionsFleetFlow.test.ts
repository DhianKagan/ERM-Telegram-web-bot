// Назначение: интеграционный сценарий create→sync→load для автопарка
// Основные модули: express, supertest, mongodb-memory-server, mongoose
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../src/utils/rateLimiter', () => () => (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
  next(),
);
jest.mock('../src/middleware/auth', () => ({
  __esModule: true,
  default: () => (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    Object.assign(req, {
      user: {
        id: 'admin',
        username: 'integration-admin',
        role: 'admin',
      },
    });
    next();
  },
}));
jest.mock('../src/auth/roles.guard', () => ({
  __esModule: true,
  default: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));
jest.mock('../src/auth/roles.decorator', () => ({
  __esModule: true,
  Roles: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

jest.mock('../src/services/wialon', () => {
  const actual = jest.requireActual('../src/services/wialon');
  return {
    __esModule: true,
    DEFAULT_BASE_URL: 'https://hst-api.wialon.com',
    decodeLocatorKey: actual.decodeLocatorKey,
    WialonHttpError: actual.WialonHttpError,
    WialonResponseError: actual.WialonResponseError,
    login: jest.fn(),
    loadUnits: jest.fn(),
    loadTrack: jest.fn(),
  };
});

const { login, loadUnits } = require('../src/services/wialon') as {
  login: jest.MockedFunction<
    (typeof import('../src/services/wialon'))['login']
  >;
  loadUnits: jest.MockedFunction<
    (typeof import('../src/services/wialon'))['loadUnits']
  >;
};

const { Fleet } = require('../src/db/models/fleet');
const { Vehicle } = require('../src/db/models/vehicle');

describe('Интеграция коллекций и флотов', () => {
  let mongod: MongoMemoryServer;
  let app: express.Express;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    app = express();
    app.use(express.json());
    const collectionsRouter = require('../src/routes/collections').default;
    const fleetsRouter = require('../src/routes/fleets').default;
    app.use('/api/v1/collections', collectionsRouter);
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
    login.mockReset();
    loadUnits.mockReset();
  });

  test('создаёт автопарк и позволяет получить транспорт', async () => {
    const locatorKey = Buffer.from('test-token', 'utf8').toString('base64');
    login.mockResolvedValue({
      sid: 'sid',
      eid: 'eid',
      user: { id: 1 },
      baseUrl: 'https://hst-api.wialon.com',
    });
    loadUnits.mockResolvedValue([
      {
        id: 101,
        name: 'Трактор',
        sensors: [],
        customSensors: [],
        position: { lat: 55, lon: 37, speed: 10, course: 90, updatedAt: new Date() },
      },
    ]);

    const createRes = await request(app)
      .post('/api/v1/collections')
      .send({
        type: 'fleets',
        name: 'Интеграционный автопарк',
        value: `https://hosting.wialon.com/locator?t=${locatorKey}`,
      })
      .expect(201);

    const id = createRes.body._id as string;
    expect(id).toBeDefined();
    const fleetDoc = await Fleet.findById(id);
    expect(fleetDoc).not.toBeNull();
    expect(login).toHaveBeenCalledWith('test-token', 'https://hst-api.wialon.com');
    const vehicles = await Vehicle.find({ fleetId: fleetDoc!._id });
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0].unitId).toBe(101);

    const vehiclesRes = await request(app)
      .get(`/api/v1/fleets/${id}/vehicles`)
      .expect(200);

    expect(vehiclesRes.body.vehicles).toHaveLength(1);
    expect(vehiclesRes.body.vehicles[0]).toMatchObject({ unitId: 101, name: 'Трактор' });
  });
});
