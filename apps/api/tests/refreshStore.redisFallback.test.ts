process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secret';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

describe('refresh store Redis fallback', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.QUEUE_REDIS_URL = '';
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
    delete process.env.QUEUE_REDIS_URL;
    jest.restoreAllMocks();
    jest.unmock('ioredis');
  });

  test('issueSession falls back to memory when Redis stream is not writeable', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    jest.doMock('ioredis', () => {
      const createMulti = () => {
        const chain = {
          set: jest.fn(() => chain),
          sadd: jest.fn(() => chain),
          expire: jest.fn(() => chain),
          srem: jest.fn(() => chain),
          del: jest.fn(() => chain),
          exec: jest
            .fn()
            .mockRejectedValue(
              new Error(
                "Stream isn't writeable and enableOfflineQueue options is false",
              ),
            ),
        };
        return chain;
      };

      const RedisMock = jest.fn().mockImplementation(() => ({
        connect: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
        multi: jest.fn(() => createMulti()),
        get: jest
          .fn()
          .mockRejectedValue(
            new Error(
              "Stream isn't writeable and enableOfflineQueue options is false",
            ),
          ),
        smembers: jest
          .fn()
          .mockRejectedValue(
            new Error(
              "Stream isn't writeable and enableOfflineQueue options is false",
            ),
          ),
      }));

      return {
        __esModule: true,
        default: RedisMock,
      };
    });

    const { __resetRefreshStoreForTests, getRefreshStore } = await import(
      '../src/services/refreshStore'
    );

    __resetRefreshStoreForTests();

    const store = getRefreshStore();
    const initialRecord = {
      userId: '1',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    };

    await store.save('hash-old', initialRecord, 60);

    const rotated = await store.rotate(
      'hash-old',
      'hash-new',
      {
        userId: '1',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      },
      60,
    );

    expect(rotated).toEqual({ status: 'rotated', userId: '1' });
    expect(warnSpy).toHaveBeenCalledWith(
      '[auth] refresh Redis unavailable, switching refresh sessions to in-memory store',
    );
  });
});
