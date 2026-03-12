// Назначение: проверка флага GEOCODER_ENABLED в конфиге воркера.
// Основные модули: jest, worker config.
export {};

const originalEnv = { ...process.env };

describe('worker config geocoder flag', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.QUEUE_REDIS_URL = 'redis://localhost:6379';
    process.env.GEOCODER_URL = 'https://nominatim.openstreetmap.org/search';
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('отключает геокодер при GEOCODER_ENABLED=false', async () => {
    process.env.GEOCODER_ENABLED = 'false';

    const { workerConfig } = await import('../apps/worker/src/config');

    expect(workerConfig.geocoder.enabled).toBe(false);
  });

  test('включает геокодер при GEOCODER_ENABLED=true', async () => {
    process.env.GEOCODER_ENABLED = 'true';

    const { workerConfig } = await import('../apps/worker/src/config');

    expect(workerConfig.geocoder.enabled).toBe(true);
  });
});

afterAll(() => {
  process.env = { ...originalEnv };
});
