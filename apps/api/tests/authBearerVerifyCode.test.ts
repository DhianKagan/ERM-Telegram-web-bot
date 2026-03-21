process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secret';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

describe('auth controller verifyCode in bearer mode', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.dontMock('../src/auth/auth.service');
    jest.dontMock('../src/utils/setTokenCookie');
    jest.dontMock('../src/services/token.service');
    jest.dontMock('../src/config');
  });

  test('возвращает только accessToken и refresh-cookie без legacy token cookie', async () => {
    jest.doMock('../src/auth/auth.service', () => ({
      __esModule: true,
      default: {
        verifyCode: jest.fn(async () => 'legacy-token'),
        codes: new Map(),
        adminCodes: new Map(),
      },
    }));

    jest.doMock('../src/utils/setTokenCookie', () => ({
      __esModule: true,
      default: jest.fn(),
      buildTokenCookieOptions: jest.fn(() => ({ httpOnly: true, path: '/' })),
    }));

    jest.doMock('../src/services/token.service', () => ({
      __esModule: true,
      decodeLegacyToken: jest.fn(() => ({
        id: '1',
        username: 'u',
        role: 'user',
        access: 1,
        is_service_account: false,
      })),
      issueSession: jest.fn(async () => ({
        accessToken: 'fresh-access',
        refreshToken: 'fresh-refresh',
      })),
      revokeRefresh: jest.fn(),
      rotateSession: jest.fn(),
      tokenSettings: {
        refreshCookieName: 'refresh',
        refreshCookiePath: '/api/v1/auth',
        refreshTtl: 3600,
      },
    }));

    jest.doMock('../src/config', () => ({
      __esModule: true,
      default: {
        cookieDomain: undefined,
      },
      authBearerEnabled: true,
    }));

    const { default: authService } = await import('../src/auth/auth.service');
    const { default: setTokenCookie } = await import('../src/utils/setTokenCookie');
    const { verifyCode } = await import('../src/auth/auth.controller');

    const res = {
      json: jest.fn(),
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
    } as never;

    await verifyCode(
      {
        body: { telegramId: 7, code: '123456', username: 'u' },
        ip: '127.0.0.1',
        get: jest.fn(() => 'agent-a'),
      } as never,
      res,
    );

    expect((authService as { verifyCode: jest.Mock }).verifyCode).toHaveBeenCalledWith(
      7,
      '123456',
      'u',
    );
    expect(setTokenCookie).not.toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith(
      expect.stringMatching(/^(?:__Secure-|__Host-)?refresh$/),
      'fresh-refresh',
      expect.objectContaining({
        httpOnly: true,
        path: '/api/v1/auth',
      }),
    );
    expect(res.json).toHaveBeenCalledWith({ accessToken: 'fresh-access' });
  });
});
