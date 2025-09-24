// Назначение: unit-тесты спецлогики автопарка в роуте коллекций
// Основные модули: jest, supertest, express, router collections
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

import express from 'express';
import request from 'supertest';

jest.mock('../src/utils/rateLimiter', () => () => (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
  next(),
);
jest.mock('../src/middleware/auth', () => ({
  __esModule: true,
  default: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));
jest.mock('../src/middleware/requireRole', () => ({
  __esModule: true,
  default: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));
jest.mock('../src/db/repos/collectionRepo', () => ({
  __esModule: true,
  create: jest.fn(),
  update: jest.fn(),
}));
jest.mock('../src/db/models/CollectionItem', () => ({
  __esModule: true,
  CollectionItem: {
    findById: jest.fn(),
  },
}));
jest.mock('../src/db/models/fleet', () => ({
  __esModule: true,
  Fleet: {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
}));
jest.mock('../src/db/models/vehicle', () => ({
  __esModule: true,
  Vehicle: {
    deleteMany: jest.fn(),
  },
}));
jest.mock('../src/utils/wialonLocator', () => ({
  __esModule: true,
  parseLocatorLink: jest.fn(),
}));
jest.mock('../src/services/fleetVehicles', () => ({
  __esModule: true,
  syncFleetVehicles: jest.fn(),
}));

const repo = require('../src/db/repos/collectionRepo') as {
  create: jest.Mock;
  update: jest.Mock;
};
const collectionModel = require('../src/db/models/CollectionItem') as {
  CollectionItem: { findById: jest.Mock };
};
const fleetModel = require('../src/db/models/fleet') as {
  Fleet: {
    create: jest.Mock;
    findById: jest.Mock;
    findByIdAndDelete: jest.Mock;
  };
};
const vehicleModel = require('../src/db/models/vehicle') as {
  Vehicle: { deleteMany: jest.Mock };
};
const locatorUtil = require('../src/utils/wialonLocator') as {
  parseLocatorLink: jest.Mock;
};
const syncService = require('../src/services/fleetVehicles') as {
  syncFleetVehicles: jest.Mock;
};

describe('Маршруты коллекций для автопарка', () => {
  const app = express();
  app.use(express.json());

  const collectionsRouter = require('../src/routes/collections').default;
  app.use('/api/v1/collections', collectionsRouter);

  beforeEach(() => {
    repo.create.mockReset();
    repo.update.mockReset();
    collectionModel.CollectionItem.findById.mockReset();
    fleetModel.Fleet.create.mockReset();
    fleetModel.Fleet.findById.mockReset();
    fleetModel.Fleet.findByIdAndDelete.mockReset();
    vehicleModel.Vehicle.deleteMany.mockReset();
    locatorUtil.parseLocatorLink.mockReset();
    syncService.syncFleetVehicles.mockReset();
  });

  test('создаёт автопарк и элемент коллекции при POST', async () => {
    locatorUtil.parseLocatorLink.mockReturnValue({
      token: 'token',
      locatorUrl: 'https://host/locator',
      baseUrl: 'https://hst-api.wialon.com',
      locatorKey: 'b64',
    });
    syncService.syncFleetVehicles.mockResolvedValue(undefined);
    fleetModel.Fleet.create.mockImplementation(async (data: Record<string, unknown>) => ({
      ...data,
      _id: data._id,
    }));
    repo.create.mockImplementation(async (data: Record<string, unknown>) => ({
      _id: String(data._id),
      type: data.type,
      name: data.name,
      value: data.value,
    }));

    const res = await request(app)
      .post('/api/v1/collections')
      .send({ type: 'fleets', name: 'Автопарк', value: 'https://host/locator?t=abcd' });

    expect(res.status).toBe(201);
    expect(locatorUtil.parseLocatorLink).toHaveBeenCalledWith(
      'https://host/locator?t=abcd',
      expect.any(String),
    );
    expect(fleetModel.Fleet.create).toHaveBeenCalledTimes(1);
    const createdId = fleetModel.Fleet.create.mock.calls[0][0]._id;
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: createdId,
        type: 'fleets',
        name: 'Автопарк',
        value: 'https://host/locator?t=abcd',
      }),
    );
    expect(syncService.syncFleetVehicles).toHaveBeenCalledTimes(1);
    expect(res.body).toMatchObject({ name: 'Автопарк', value: 'https://host/locator?t=abcd' });
  });

  test('возвращает предупреждение при ошибке синхронизации автопарка', async () => {
    locatorUtil.parseLocatorLink.mockReturnValue({
      token: 'token',
      locatorUrl: 'https://host/locator',
      baseUrl: 'https://hst-api.wialon.com',
      locatorKey: 'b64',
    });
    const { WialonHttpError } = require('../src/services/wialon');
    syncService.syncFleetVehicles.mockRejectedValue(
      new WialonHttpError('token/login', 502, 'Bad Gateway'),
    );
    fleetModel.Fleet.create.mockImplementation(async (data: Record<string, unknown>) => ({
      ...data,
      _id: data._id,
    }));
    repo.create.mockImplementation(async (data: Record<string, unknown>) => ({
      ...data,
      _id: String(data._id),
      toJSON() {
        return {
          _id: this._id,
          type: this.type,
          name: this.name,
          value: this.value,
        };
      },
    }));

    const res = await request(app)
      .post('/api/v1/collections')
      .send({ type: 'fleets', name: 'Автопарк', value: 'https://host/locator?t=abcd' });

    expect(res.status).toBe(201);
    expect(res.body.meta).toMatchObject({ syncPending: true });
    expect(res.body.meta.syncWarning).toContain('синхронизация транспорта');
    expect(res.body.meta.syncError).toContain('ошибкой 502');
    expect(fleetModel.Fleet.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test('обновляет существующий автопарк и синхронизирует транспорт', async () => {
    collectionModel.CollectionItem.findById.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      type: 'fleets',
      name: 'Старый',
      value: 'https://host/locator?t=old',
      save: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        type: 'fleets',
        name: 'Новый',
        value: 'https://host/locator?t=new',
      }),
    });
    locatorUtil.parseLocatorLink.mockReturnValue({
      token: 'new-token',
      locatorUrl: 'https://host/locator?t=new',
      baseUrl: 'https://hst-api.wialon.com',
      locatorKey: 'bmV3',
    });
    const saveMock = jest.fn().mockResolvedValue(undefined);
    fleetModel.Fleet.findById.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      name: 'Старый',
      token: 'token',
      locatorUrl: 'https://host/locator?t=old',
      baseUrl: 'https://hst-api.wialon.com',
      locatorKey: 'b2xk',
      save: saveMock,
    });
    syncService.syncFleetVehicles.mockResolvedValue(undefined);

    const res = await request(app)
      .put('/api/v1/collections/507f1f77bcf86cd799439011')
      .send({ name: 'Новый', value: 'https://host/locator?t=new' });

    expect(res.status).toBe(200);
    expect(locatorUtil.parseLocatorLink).toHaveBeenCalledWith(
      'https://host/locator?t=new',
      expect.any(String),
    );
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(syncService.syncFleetVehicles).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Новый' }),
    );
    expect(repo.update).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ name: 'Новый', value: 'https://host/locator?t=new' });
  });

  test('удаляет автопарк и связанные записи', async () => {
    const deleteOne = jest.fn().mockResolvedValue({});
    collectionModel.CollectionItem.findById.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      type: 'fleets',
      deleteOne,
    });
    vehicleModel.Vehicle.deleteMany.mockResolvedValue({});
    fleetModel.Fleet.findByIdAndDelete.mockResolvedValue({});

    const res = await request(app).delete('/api/v1/collections/507f1f77bcf86cd799439011');

    expect(res.status).toBe(200);
    expect(vehicleModel.Vehicle.deleteMany).toHaveBeenCalledWith({
      fleetId: '507f1f77bcf86cd799439011',
    });
    expect(fleetModel.Fleet.findByIdAndDelete).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
    );
    expect(deleteOne).toHaveBeenCalledTimes(1);
  });
});
