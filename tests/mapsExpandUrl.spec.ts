/**
 * Назначение файла: проверка fallback для разворачивания ссылок Google Maps.
 * Основные модули: services/maps.
 */

jest.mock('dns/promises', () => ({
  lookup: jest.fn().mockResolvedValue([{ address: '8.8.8.8' }]),
}));

import { expandMapsUrl } from '../apps/api/src/services/maps';

describe('expandMapsUrl', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('возвращает исходный URL при временной сетевой ошибке fetch', async () => {
    const mapsShortUrl = 'https://maps.app.goo.gl/h4DvKu4FwHBpfnJz9';
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('fetch failed'));

    await expect(expandMapsUrl(mapsShortUrl)).resolves.toBe(mapsShortUrl);
  });
});
