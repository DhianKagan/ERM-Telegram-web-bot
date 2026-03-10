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

  it('для maps.app.goo.gl предпочитает place-ссылку из redirect: follow даже если manual уже вернул координаты', async () => {
    const mapsShortUrl = 'https://maps.app.goo.gl/G1AifBj28FDnYTfY7';
    const manualExpandedUrl =
      'https://www.google.com/maps/@46.3901372,30.7095786,206m/data=!3m1!1e3?entry=ttu';
    const placeExpandedUrl =
      'https://www.google.com/maps/place/%D0%9D%D0%BE%D0%B2%D0%B0+%D0%9F%D0%BE%D1%88%D1%82%D0%B0/@46.3900041,30.7097575,177m/data=!3m1!1e3';

    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        status: 302,
        headers: new Headers({
          location: manualExpandedUrl,
        }),
        text: async () => '',
      } as Response)
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        url: manualExpandedUrl,
        text: async () => '<html><body>ok</body></html>',
      } as Response)
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        url: placeExpandedUrl,
        text: async () => '<html><body>ok</body></html>',
      } as Response);

    const expandMapsUrl = await importExpandMapsUrl();
    await expect(expandMapsUrl(mapsShortUrl)).resolves.toBe(placeExpandedUrl);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
  it('разворачивает maps.app.goo.gl через fallback с redirect: follow', async () => {
    const mapsShortUrl = 'https://maps.app.goo.gl/9xjhwpxs9cnNhdqy5';
    const expandedUrl =
      'https://www.google.com/maps/place/%D0%9F%D0%B8%D0%B2%D0%B7%D0%B0%D0%B2%D0%BE%D0%B4/@46.3409589,30.6713341,240m/data=!3m1!1e3!4m6!3m5!1s0x40c7cb8dda3eaa89:0xb40a2a1459f63cb8!8m2!3d46.340739!4d30.671928!16s%2Fg%2F12vs__yfz';

    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        url: mapsShortUrl,
        text: async () => '<html><body>no coords in body</body></html>',
      } as Response)
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        url: expandedUrl,
        text: async () => '<html><body>ok</body></html>',
      } as Response);

    const expandMapsUrl = await importExpandMapsUrl();
    await expect(expandMapsUrl(mapsShortUrl)).resolves.toBe(expandedUrl);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
