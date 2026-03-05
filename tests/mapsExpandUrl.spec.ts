/**
 * Назначение файла: проверка fallback для разворачивания ссылок Google Maps.
 * Основные модули: services/maps.
 */

jest.mock('dns/promises', () => ({
  lookup: jest.fn().mockResolvedValue([{ address: '8.8.8.8' }]),
}));

const importExpandMapsUrl = async () => {
  const mod = await import('../apps/api/src/services/maps');
  return mod.expandMapsUrl;
};

describe('expandMapsUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('возвращает исходный URL при временной сетевой ошибке fetch', async () => {
    const mapsShortUrl = 'https://maps.app.goo.gl/h4DvKu4FwHBpfnJz9';
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('fetch failed'));

    const expandMapsUrl = await importExpandMapsUrl();
    await expect(expandMapsUrl(mapsShortUrl)).resolves.toBe(mapsShortUrl);
  });

  it('не падает при недоступном playwright fallback и возвращает final URL', async () => {
    const mapsShortUrl = 'https://maps.app.goo.gl/h4DvKu4FwHBpfnJz9';
    process.env.MAPS_HEADLESS_FALLBACK = 'playwright';
    process.env.MAPS_HEADLESS_MODULE_NAME = '__missing_playwright__';

    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 200,
      headers: new Headers(),
      text: async () => '<html><head></head><body>no coords</body></html>',
    } as Response);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
      // noop for test output
    });

    const expandMapsUrl = await importExpandMapsUrl();
    await expect(expandMapsUrl(mapsShortUrl)).resolves.toBe(mapsShortUrl);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('возвращает исходный URL при редиректе на intent-ссылку', async () => {
    const mapsShortUrl = 'https://maps.app.goo.gl/W3ae6PPzPePpegJU7';
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 302,
      headers: new Headers({
        location:
          'intent://maps.google.com/maps/place/AGROMARKET#Intent;scheme=https;package=com.google.android.apps.maps;end',
      }),
      text: async () => '',
    } as Response);

    const expandMapsUrl = await importExpandMapsUrl();
    await expect(expandMapsUrl(mapsShortUrl)).resolves.toBe(mapsShortUrl);
  });

  it('возвращает исходный URL при ENOTFOUND во время fetch', async () => {
    const mapsShortUrl = 'https://maps.app.goo.gl/W3ae6PPzPePpegJU7';
    const error = new Error(
      'getaddrinfo ENOTFOUND maps.app.goo.gl',
    ) as Error & {
      code?: string;
    };
    error.code = 'ENOTFOUND';
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(error);

    const expandMapsUrl = await importExpandMapsUrl();
    await expect(expandMapsUrl(mapsShortUrl)).resolves.toBe(mapsShortUrl);
  });
});
