// Назначение: проверка флагов cookie токена для разных окружений.
// Модули: jest, setTokenCookie
import setTokenCookie, {
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

  it('использует secure=true и SameSite=none в production по умолчанию', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.COOKIE_SECURE;

    const options = buildTokenCookieOptions({
      appUrl: 'https://example.com',
      cookieDomain: undefined,
    } as typeof import('../src/config').default);

    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe('none');
    expect(options.domain).toBe('example.com');
  });
});
