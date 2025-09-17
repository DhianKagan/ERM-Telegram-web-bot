// Назначение: проверка синхронизации транспорта флота
// Основные модули: mongoose, mongodb-memory-server, сервис fleetVehicles
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

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
  login: jest.fn(),
  loadUnits: jest.fn(),
}));

import { Fleet } from '../src/db/models/fleet';
import { Vehicle } from '../src/db/models/vehicle';
import { syncFleetVehicles, syncAllFleets } from '../src/services/fleetVehicles';
import { login, loadUnits } from '../src/services/wialon';

jest.setTimeout(60000);

const mockedLogin = login as jest.MockedFunction<typeof login>;
const mockedLoadUnits = loadUnits as jest.MockedFunction<typeof loadUnits>;

describe('fleetVehicles sync', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
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
    mockedLoadUnits.mockReset();
  });

  it('обновляет данные транспорта флота', async () => {
    const fleet = await Fleet.create({
      name: 'Флот',
      token: 'token',
      locatorUrl: 'https://hosting.wialon.com/locator?t=dG9rZW4=',
      baseUrl: 'https://hst-api.wialon.com',
      locatorKey: 'dG9rZW4=',
    });
    mockedLogin.mockResolvedValue({ sid: 'sid', eid: 'eid', user: { id: 1 } });
    const updatedAt = new Date('2024-01-01T00:00:00.000Z');
    mockedLoadUnits.mockResolvedValue([
      {
        id: 101,
        name: 'Экскаватор',
        position: { lat: 55.75, lon: 37.6, speed: 12, course: 180, updatedAt },
        sensors: [
          {
            id: 1,
            name: 'Топливо',
            type: 'fuel',
            value: 45,
            updatedAt,
          },
        ],
      },
    ]);

    await syncFleetVehicles(fleet);

    const stored = await Vehicle.findOne({ fleetId: fleet._id, unitId: 101 }).lean();
    expect(stored?.name).toBe('Экскаватор');
    expect(stored?.position?.lat).toBeCloseTo(55.75);
    expect(stored?.sensors?.[0]?.name).toBe('Топливо');
    expect(mockedLogin).toHaveBeenCalledWith('token', 'https://hst-api.wialon.com');
    expect(mockedLoadUnits).toHaveBeenCalledWith('sid', 'https://hst-api.wialon.com');
  });

  it('удаляет транспорт, отсутствующий в выгрузке', async () => {
    const fleet = await Fleet.create({
      name: 'Флот',
      token: 'token',
      locatorUrl: 'https://hosting.wialon.com/locator?t=dG9rZW4=',
      baseUrl: 'https://hst-api.wialon.com',
      locatorKey: 'dG9rZW4=',
    });
    await Vehicle.create({ fleetId: fleet._id, unitId: 5, name: 'Старый', sensors: [] });
    mockedLogin.mockResolvedValue({ sid: 'sid', eid: 'eid', user: { id: 1 } });
    mockedLoadUnits.mockResolvedValue([
      {
        id: 6,
        name: 'Новый',
        position: undefined,
        sensors: [],
      },
    ]);

    await syncAllFleets();

    const units = await Vehicle.find({ fleetId: fleet._id }).lean();
    expect(units).toHaveLength(1);
    expect(units[0]?.unitId).toBe(6);
    expect(mockedLogin).toHaveBeenCalledWith('token', 'https://hst-api.wialon.com');
  });
});
