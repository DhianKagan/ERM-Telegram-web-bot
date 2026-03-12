// Назначение: автотесты. Модули: jest, supertest.
// Тесты сервиса maps: разворачивание ссылок и координаты
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.JWT_SECRET = 's';
process.env.APP_URL = 'https://localhost';
process.env.NOMINATIM_MIN_INTERVAL_MS = '0';
process.env.NOMINATIM_USER_AGENT = 'jest-agent (+https://example.com/contact)';

jest.mock('dns/promises', () => ({
  lookup: jest.fn().mockResolvedValue([{ address: '1.1.1.1', family: 4 }]),
}));

import {
  expandMapsUrl,
  extractCoords,
  shouldExpandMapsUrl,
  searchAddress,
  reverseGeocode,
} from '../src/services/maps';
import { lookup } from 'dns/promises';
import { stopScheduler } from '../src/services/scheduler';
import { stopQueue } from '../src/services/messageQueue';

const lookupMock = lookup as jest.MockedFunction<typeof lookup>;

test('shouldExpandMapsUrl использует единый allowlist Google-хостов', () => {
  expect(
    shouldExpandMapsUrl('https://google.com/maps/@50.4501,30.5234,17z'),
  ).toBe(true);
  expect(
    shouldExpandMapsUrl('https://www.google.co.uk/maps/@50.4501,30.5234,17z'),
  ).toBe(true);
  expect(shouldExpandMapsUrl('https://maps.google.de/?q=50.4501,30.5234')).toBe(
    true,
  );
});

test('shouldExpandMapsUrl отклоняет небезопасные URL', () => {
  expect(shouldExpandMapsUrl('http://maps.app.goo.gl/test')).toBe(false);
  expect(shouldExpandMapsUrl('https://user@maps.app.goo.gl/test')).toBe(false);
  expect(shouldExpandMapsUrl('https://maps.app.goo.gl:444/test')).toBe(false);
  expect(shouldExpandMapsUrl('https://example.com/maps')).toBe(false);
});

test('expandMapsUrl отклоняет небезопасный протокол даже при наличии координат в URL', async () => {
  await expect(
    expandMapsUrl('http://maps.app.goo.gl/?q=46.3877422,30.7065156'),
  ).rejects.toThrow('Недопустимый протокол URL');
});

test('expandMapsUrl отклоняет не-Google домен даже при наличии координат в URL', async () => {
  await expect(
    expandMapsUrl('https://example.com/?q=46.3877422,30.7065156'),
  ).rejects.toThrow('Недопустимый домен URL');
});

test('expandMapsUrl разворачивает прямой consent wrapper до раннего выхода по координатам', async () => {
  global.fetch = jest.fn();

  const res = await expandMapsUrl(
    'https://consent.google.com/m?continue=https%3A%2F%2Fwww.google.com%2Fmaps%2F%4046.3877422%2C30.7065156%2C17z',
  );

  expect(res).toBe('https://www.google.com/maps/@46.3877422,30.7065156,17z');
  expect(fetch).not.toHaveBeenCalled();
});

test('expandMapsUrl разворачивает прямой google wrapper с url до раннего выхода по координатам', async () => {
  global.fetch = jest.fn();

  const res = await expandMapsUrl(
    'https://www.google.com/url?url=https%3A%2F%2Fwww.google.com%2Fmaps%2F%4046.3877422%2C30.7065156%2C17z',
  );

  expect(res).toBe('https://www.google.com/maps/@46.3877422,30.7065156,17z');
  expect(fetch).not.toHaveBeenCalled();
});

test('expandMapsUrl возвращает полный url', async () => {
  const text = jest.fn();
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      status: 302,
      headers: new Headers({
        location: 'https://maps.google.com/@10.1,20.2,15z',
      }),
    })
    .mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      text,
    });
  const res = await expandMapsUrl('https://maps.app.goo.gl/test');
  expect(fetch).toHaveBeenNthCalledWith(1, 'https://maps.app.goo.gl/test', {
    redirect: 'manual',
  });
  expect(fetch).toHaveBeenNthCalledWith(
    2,
    'https://maps.google.com/@10.1,20.2,15z',
    {
      redirect: 'manual',
    },
  );
  expect(res).toBe('https://maps.google.com/@10.1,20.2,15z');
  expect(text).not.toHaveBeenCalled();
});

test('expandMapsUrl принимает редирект на google.com/maps', async () => {
  const text = jest.fn();
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      status: 302,
      headers: new Headers({
        location: 'https://google.com/maps/@46.3877422,30.7065156,17z',
      }),
    })
    .mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      text,
    });
  const res = await expandMapsUrl('https://maps.app.goo.gl/test');
  expect(res).toBe('https://google.com/maps/@46.3877422,30.7065156,17z');
  expect(text).not.toHaveBeenCalled();
});

test('expandMapsUrl разворачивает google consent redirect с continue', async () => {
  const text = jest.fn();
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      status: 302,
      headers: new Headers({
        location:
          'https://consent.google.com/m?continue=https%3A%2F%2Fwww.google.com%2Fmaps%2F%4046.3877422%2C30.7065156%2C17z',
      }),
    })
    .mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      text,
    });

  const res = await expandMapsUrl('https://maps.app.goo.gl/test');

  expect(fetch).toHaveBeenNthCalledWith(1, 'https://maps.app.goo.gl/test', {
    redirect: 'manual',
  });
  expect(fetch).toHaveBeenNthCalledWith(
    2,
    'https://www.google.com/maps/@46.3877422,30.7065156,17z',
    {
      redirect: 'manual',
    },
  );
  expect(res).toBe('https://www.google.com/maps/@46.3877422,30.7065156,17z');
  expect(text).not.toHaveBeenCalled();
});

test('expandMapsUrl нормализует ссылку статической карты', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      status: 302,
      headers: new Headers({
        location:
          'https://maps.google.com/maps/api/staticmap?center=46.47561,30.709174&zoom=16&size=200x200&markers=46.47561,30.709174&sensor=false',
      }),
    })
    .mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      text: jest.fn(),
    });
  const res = await expandMapsUrl('https://maps.app.goo.gl/static');
  expect(res).toBe('https://www.google.com/maps/@46.475610,30.709174,17z');
});

test('expandMapsUrl парсит ссылку из html-ответа', async () => {
  const html =
    '<html><head><link rel="canonical" href="https://www.google.com/maps/place/Point/@48.123456,30.654321,17z" /></head></html>';
  global.fetch = jest.fn().mockResolvedValue({
    status: 200,
    headers: new Headers(),
    text: jest.fn().mockResolvedValue(html),
  });
  const res = await expandMapsUrl('https://maps.app.goo.gl/test');
  expect(res).toBe(
    'https://www.google.com/maps/place/Point/@48.123456,30.654321,17z',
  );
});

test('expandMapsUrl строит ссылку по координатам из тела', async () => {
  const html = '<html><body>!3d49.98765!4d36.12345</body></html>';
  global.fetch = jest.fn().mockResolvedValue({
    status: 200,
    headers: new Headers(),
    text: jest.fn().mockResolvedValue(html),
  });
  const res = await expandMapsUrl('https://maps.app.goo.gl/test');
  expect(res).toBe('https://www.google.com/maps/@49.987650,36.123450,17z');
});

test('expandMapsUrl парсит экранированную ссылку из js-ответа', async () => {
  const html =
    '<script>var u="https:\\/\\/www.google.com\\/maps\\/place\\/Point\\/@48.123456,30.654321,17z?entry=ttu";</script>';
  global.fetch = jest.fn().mockResolvedValue({
    status: 200,
    headers: new Headers(),
    text: jest.fn().mockResolvedValue(html),
  });
  const res = await expandMapsUrl('https://maps.app.goo.gl/test');
  expect(res).toBe(
    'https://www.google.com/maps/place/Point/@48.123456,30.654321,17z?entry=ttu',
  );
});

test('expandMapsUrl парсит ссылку google.com/maps из html-ответа', async () => {
  const html =
    '<html><head><link rel="canonical" href="https://google.com/maps/place/Point/@46.3877422,30.7065156,17z" /></head></html>';
  global.fetch = jest.fn().mockResolvedValue({
    status: 200,
    headers: new Headers(),
    text: jest.fn().mockResolvedValue(html),
  });
  const res = await expandMapsUrl('https://maps.app.goo.gl/test');
  expect(res).toBe(
    'https://google.com/maps/place/Point/@46.3877422,30.7065156,17z',
  );
});

test('expandMapsUrl извлекает place-ссылку из HTML после redirect: follow', async () => {
  const followedHtml =
    '<html><head><link rel="canonical" href="https://www.google.com/maps/place/%D0%9D%D0%BE%D0%B2%D0%B0+%D0%9F%D0%BE%D1%88%D1%82%D0%B0/@46.3903081,30.7093932,892m/data=!3m1!1e3" /></head></html>';
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      status: 302,
      headers: new Headers({
        location: 'https://www.google.com/maps/@46.390308,30.709393,17z',
      }),
    })
    .mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      text: jest.fn(),
    })
    .mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      url: 'https://www.google.com/maps/@46.390308,30.709393,17z',
      text: jest.fn().mockResolvedValue(followedHtml),
    });

  const res = await expandMapsUrl('https://maps.app.goo.gl/test');

  expect(fetch).toHaveBeenNthCalledWith(
    3,
    'https://www.google.com/maps/@46.390308,30.709393,17z',
    expect.objectContaining({
      redirect: 'follow',
    }),
  );
  expect(res).toBe(
    'https://www.google.com/maps/place/%D0%9D%D0%BE%D0%B2%D0%B0+%D0%9F%D0%BE%D1%88%D1%82%D0%B0/@46.3903081,30.7093932,892m/data=!3m1!1e3',
  );
});

test('expandMapsUrl возвращает исходный URL при ошибке failed to fetch', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('Failed to fetch'));

  const res = await expandMapsUrl('https://maps.app.goo.gl/test');

  expect(res).toBe('https://maps.app.goo.gl/test');
});

test('expandMapsUrl возвращает исходный URL при циклических редиректах', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      status: 302,
      headers: new Headers({
        location: 'https://maps.app.goo.gl/test-2',
      }),
    })
    .mockResolvedValueOnce({
      status: 302,
      headers: new Headers({
        location: 'https://maps.app.goo.gl/test',
      }),
    });

  const res = await expandMapsUrl('https://maps.app.goo.gl/test');

  expect(res).toBe('https://maps.app.goo.gl/test');
});

test('expandMapsUrl возвращает исходный URL при TLS/certificate ошибке', async () => {
  global.fetch = jest
    .fn()
    .mockRejectedValue(new Error('TLS handshake failed: certificate expired'));

  const res = await expandMapsUrl('https://maps.app.goo.gl/test');

  expect(res).toBe('https://maps.app.goo.gl/test');
});

test('expandMapsUrl возвращает исходный URL при TypeError NetworkError', async () => {
  global.fetch = jest
    .fn()
    .mockRejectedValue(new TypeError('NetworkError when attempting to fetch'));

  const res = await expandMapsUrl('https://maps.app.goo.gl/test');

  expect(res).toBe('https://maps.app.goo.gl/test');
});

test('expandMapsUrl использует headless fallback до fetch при MAPS_HEADLESS_FALLBACK=playwright', async () => {
  const originalHeadlessFallback = process.env.MAPS_HEADLESS_FALLBACK;
  const originalHeadlessTimeout = process.env.MAPS_HEADLESS_TIMEOUT_MS;
  const originalFetch = global.fetch;
  process.env.MAPS_HEADLESS_FALLBACK = 'playwright';
  process.env.MAPS_HEADLESS_TIMEOUT_MS = '1500';

  const gotoMock = jest.fn().mockResolvedValue(undefined);
  const evaluateMock = jest
    .fn()
    .mockResolvedValue('https://www.google.com/maps/@46.390308,30.709393,17z');
  const waitForTimeoutMock = jest.fn().mockResolvedValue(undefined);
  const pageCloseMock = jest.fn().mockResolvedValue(undefined);
  const contextCloseMock = jest.fn().mockResolvedValue(undefined);
  const browserCloseMock = jest.fn().mockResolvedValue(undefined);

  jest.doMock('playwright', () => ({
    chromium: {
      launch: jest.fn().mockResolvedValue({
        newContext: jest.fn().mockResolvedValue({
          newPage: jest.fn().mockResolvedValue({
            goto: gotoMock,
            evaluate: evaluateMock,
            locator: jest.fn().mockReturnValue({
              first: () => ({ textContent: jest.fn().mockResolvedValue(null) }),
            }),
            waitForTimeout: waitForTimeoutMock,
            close: pageCloseMock,
          }),
          close: contextCloseMock,
        }),
        close: browserCloseMock,
      }),
    },
  }));

  const fetchMock = jest.fn();
  global.fetch = fetchMock as typeof global.fetch;

  let expandMapsUrlIsolated: (url: string) => Promise<string>;
  await jest.isolateModulesAsync(async () => {
    const mapsModule = await import('../src/services/maps');
    expandMapsUrlIsolated = mapsModule.expandMapsUrl;
  });

  const res = await expandMapsUrlIsolated!('https://maps.app.goo.gl/test');

  expect(res).toBe('https://www.google.com/maps/@46.390308,30.709393,17z');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(gotoMock).toHaveBeenCalled();

  jest.dontMock('playwright');
  if (originalHeadlessFallback === undefined) {
    delete process.env.MAPS_HEADLESS_FALLBACK;
  } else {
    process.env.MAPS_HEADLESS_FALLBACK = originalHeadlessFallback;
  }
  if (originalHeadlessTimeout === undefined) {
    delete process.env.MAPS_HEADLESS_TIMEOUT_MS;
  } else {
    process.env.MAPS_HEADLESS_TIMEOUT_MS = originalHeadlessTimeout;
  }
  global.fetch = originalFetch;
});

test('expandMapsUrl не падает, если DNS Google-хоста возвращает только private IPv6', async () => {
  lookupMock.mockResolvedValueOnce([{ address: 'fd12::1', family: 6 }]);
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      status: 302,
      headers: new Headers({
        location: 'https://maps.google.com/@10.1,20.2,15z',
      }),
    })
    .mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      text: jest.fn(),
    });

  const res = await expandMapsUrl('https://maps.app.goo.gl/test');

  expect(res).toBe('https://maps.google.com/@10.1,20.2,15z');
});

test('extractCoords извлекает широту и долготу', () => {
  const coords = extractCoords('https://maps.google.com/@10.1,20.2,15z');
  expect(coords).toEqual({ lat: 10.1, lng: 20.2 });
});

test('extractCoords извлекает координаты из geo-ссылки', () => {
  const coords = extractCoords('geo:48.477836,30.705930?q=point');
  expect(coords).toEqual({ lat: 48.477836, lng: 30.70593 });
});

test('extractCoords извлекает координаты из произвольного query-параметра', () => {
  const coords = extractCoords(
    'https://www.google.com/maps?destination=Kyiv&checkpoint=48.477836,30.705930',
  );
  expect(coords).toEqual({ lat: 48.477836, lng: 30.70593 });
});

test('extractCoords извлекает координаты из !1d/!2d формата', () => {
  const coords = extractCoords(
    'https://www.google.com/maps/place/Point/data=!3m1!4b1!1d30.70593!2d48.477836',
  );
  expect(coords).toEqual({ lat: 48.477836, lng: 30.70593 });
});

test('searchAddress нормализует подсказки', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => [
      {
        place_id: 123,
        display_name: 'вулиця Шевченка, Львів, Україна',
        lat: '49.8397',
        lon: '24.0297',
      },
    ],
  });
  const results = await searchAddress('шевченка', {
    limit: 7,
    language: 'uk-UA,uk',
  });
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/search?'),
    expect.objectContaining({
      headers: expect.objectContaining({
        'User-Agent': expect.stringContaining('jest-agent'),
        'Accept-Language': 'uk-UA,uk',
      }),
    }),
  );
  expect(results).toEqual([
    expect.objectContaining({
      id: '123',
      label: 'вулиця Шевченка',
      description: 'Львів, Україна',
      lat: 49.8397,
      lng: 24.0297,
      source: 'nominatim',
    }),
  ]);
});

test('reverseGeocode возвращает null при ошибке', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
  const place = await reverseGeocode({ lat: 50, lng: 30 });
  expect(place).toBeNull();
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
