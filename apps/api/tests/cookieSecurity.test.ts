process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secret';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://app.example.test';

import {
  isSecureCookiesEnabled,
  resolveCookieName,
} from '../src/utils/cookieSecurity';
import { buildTokenCookieOptions } from '../src/utils/setTokenCookie';

describe('cookie security helpers', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCookieSecure = process.env.COOKIE_SECURE;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalCookieSecure === undefined) {
      delete process.env.COOKIE_SECURE;
    } else {
      process.env.COOKIE_SECURE = originalCookieSecure;
    }
  });

  test('host-only cookie не добавляет Domain без явного COOKIE_DOMAIN', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.COOKIE_SECURE;

    const options = buildTokenCookieOptions({
      appUrl: 'https://app.example.test',
      cookieDomain: undefined,
    } as never);

    expect(options.secure).toBe(true);
    expect(options.domain).toBeUndefined();
    expect(options.path).toBe('/');
  });

  test('resolveCookieName выбирает безопасные префиксы по области cookie', () => {
    expect(isSecureCookiesEnabled()).toBe(false);
    expect(
      resolveCookieName('erm.sid', {
        secure: true,
        path: '/',
      }),
    ).toBe('__Host-erm.sid');
    expect(
      resolveCookieName('refresh', {
        secure: true,
        path: '/api/v1/auth',
      }),
    ).toBe('__Secure-refresh');
    expect(
      resolveCookieName('__Secure-custom', {
        secure: true,
        path: '/api/v1/auth',
      }),
    ).toBe('__Secure-custom');
  });
});
