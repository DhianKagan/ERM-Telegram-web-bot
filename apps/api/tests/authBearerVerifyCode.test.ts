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

  test('возвращает accessToken c legacy-алиасом token и refresh-cookie без legacy token cookie', async () => {
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
    const { default: setTokenCookie } = await import(
      '../src/utils/setTokenCookie'
    );
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

    expect(
      (authService as { verifyCode: jest.Mock }).verifyCode,
    ).toHaveBeenCalledWith(7, '123456', 'u');
    expect(setTokenCookie).not.toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith(
      expect.stringMatching(/^(?:__Secure-|__Host-)?refresh$/),
      'fresh-refresh',
      expect.objectContaining({
        httpOnly: true,
        path: '/api/v1/auth',
      }),
    );
    expect(res.json).toHaveBeenCalledWith({
      accessToken: 'fresh-access',
      token: 'fresh-access',
    });
  });

  test('passwordLogin в bearer mode возвращает accessToken и refresh-cookie', async () => {
    jest.doMock('../src/auth/auth.service', () => ({
      __esModule: true,
      default: {
        verifyPasswordLogin: jest.fn(async () => 'legacy-token'),
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
    const { default: setTokenCookie } = await import(
      '../src/utils/setTokenCookie'
    );
    const { passwordLogin } = await import('../src/auth/auth.controller');

    const res = {
      json: jest.fn(),
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
    } as never;

    await passwordLogin(
      {
        body: { username: 'svc', password: 'secret123' },
        ip: '127.0.0.1',
        get: jest.fn(() => 'agent-a'),
      } as never,
      res,
    );

    expect(
      (authService as { verifyPasswordLogin: jest.Mock }).verifyPasswordLogin,
    ).toHaveBeenCalledWith('svc', 'secret123');
    expect(setTokenCookie).not.toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith(
      expect.stringMatching(/^(?:__Secure-|__Host-)?refresh$/),
      'fresh-refresh',
      expect.objectContaining({
        httpOnly: true,
        path: '/api/v1/auth',
      }),
    );
    expect(res.json).toHaveBeenCalledWith({
      accessToken: 'fresh-access',
      token: 'fresh-access',
    });
  });

  test('verifyInitData в bearer mode возвращает accessToken и refresh-cookie', async () => {
    jest.doMock('../src/auth/auth.service', () => ({
      __esModule: true,
      default: {
        verifyInitData: jest.fn(async () => 'legacy-token'),
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
    const { default: setTokenCookie } = await import(
      '../src/utils/setTokenCookie'
    );
    const { verifyInitData } = await import('../src/auth/auth.controller');

    const res = {
      json: jest.fn(),
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
    } as never;

    await verifyInitData(
      {
        body: { initData: 'query_id=1' },
        ip: '127.0.0.1',
        get: jest.fn(() => 'agent-a'),
      } as never,
      res,
    );

    expect(
      (authService as { verifyInitData: jest.Mock }).verifyInitData,
    ).toHaveBeenCalledWith('query_id=1');
    expect(setTokenCookie).not.toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith(
      expect.stringMatching(/^(?:__Secure-|__Host-)?refresh$/),
      'fresh-refresh',
      expect.objectContaining({
        httpOnly: true,
        path: '/api/v1/auth',
      }),
    );
    expect(res.json).toHaveBeenCalledWith({
      accessToken: 'fresh-access',
      token: 'fresh-access',
    });
  });

  test('refresh в bearer mode не использует legacy token-cookie как fallback', async () => {
    jest.doMock('../src/auth/auth.service', () => ({
      __esModule: true,
      default: {
        codes: new Map(),
        adminCodes: new Map(),
      },
    }));

    jest.doMock('../src/services/token.service', () => ({
      __esModule: true,
      decodeLegacyToken: jest.fn(),
      issueSession: jest.fn(),
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

    const { refresh } = await import('../src/auth/auth.controller');

    const res = {
      json: jest.fn(),
      cookie: jest.fn(),
      sendStatus: jest.fn(),
      status: jest.fn().mockReturnThis(),
      clearCookie: jest.fn(),
    } as never;

    await refresh(
      {
        cookies: { token: 'legacy-cookie' },
      } as never,
      res,
    );

    expect(res.sendStatus).toHaveBeenCalledWith(401);
    expect(res.json).not.toHaveBeenCalled();
  });
});
