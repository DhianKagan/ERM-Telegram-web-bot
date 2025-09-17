// Назначение: проверка запуска планировщика транспорта
// Основные модули: jest, node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({ stop: jest.fn() })),
}));

jest.mock('../src/services/fleetVehicles', () => ({
  __esModule: true,
  syncAllFleets: jest.fn(),
}));

const cron = require('node-cron');
const { syncAllFleets } = require('../src/services/fleetVehicles');
const {
  startFleetVehiclesScheduler,
  stopFleetVehiclesScheduler,
} = require('../src/services/fleetVehiclesScheduler');

describe('fleet vehicles scheduler', () => {
  beforeEach(() => {
    cron.schedule.mockClear();
    syncAllFleets.mockClear();
    stopFleetVehiclesScheduler();
  });

  it('планирует задачу с выражением по умолчанию', async () => {
    syncAllFleets.mockResolvedValue(undefined);
    startFleetVehiclesScheduler();
    expect(cron.schedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function));
    await Promise.resolve();
    expect(syncAllFleets).toHaveBeenCalled();
    stopFleetVehiclesScheduler();
  });

  it('не создаёт новую задачу при повторном запуске', () => {
    syncAllFleets.mockResolvedValue(undefined);
    startFleetVehiclesScheduler();
    startFleetVehiclesScheduler();
    expect(cron.schedule).toHaveBeenCalledTimes(1);
    stopFleetVehiclesScheduler();
  });
});
