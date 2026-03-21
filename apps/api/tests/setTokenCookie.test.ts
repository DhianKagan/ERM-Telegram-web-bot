// Назначение: проверка флагов cookie токена для разных окружений.
// Модули: jest, setTokenCookie
import setTokenCookie, {
  buildLegacyTokenCookieOptions,
  buildTokenCookieOptions,
} from '../src/utils/setTokenCookie';

describe('setTokenCookie', () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
    jest.restoreAllMocks();
  });

  it('использует secure=false и SameSite=lax при COOKIE_SECURE=false', () => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECURE = 'false';

    const res = {
      cookie: jest.fn(),
    } as unknown as Parameters<typeof setTokenCookie>[0];

    setTokenCookie(res, 'token');

    expect(res.cookie).toHaveBeenCalledTimes(1);
    const [, , options] = (res.cookie as jest.Mock).mock.calls[0];
    expect(options.secure).toBe(false);
    expect(options.sameSite).toBe('lax');
    expect(options.domain).toBeUndefined();
  });

  it('использует host-only cookie без Domain в production по умолчанию', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.COOKIE_SECURE;

    const options = buildTokenCookieOptions({
      appUrl: 'https://example.com',
      cookieDomain: undefined,
    } as typeof import('../src/config').default);

    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe('none');
    expect(options.domain).toBeUndefined();
  });

  it('собирает legacy-опции cookie с прежним domain и path для очистки', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.COOKIE_SECURE;

    const options = buildLegacyTokenCookieOptions(
      {
        appUrl: 'https://example.com',
        cookieDomain: undefined,
      } as typeof import('../src/config').default,
      undefined,
      '/api/v1/auth',
    );

    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe('none');
    expect(options.domain).toBe('example.com');
    expect(options.path).toBe('/api/v1/auth');
  });
});
