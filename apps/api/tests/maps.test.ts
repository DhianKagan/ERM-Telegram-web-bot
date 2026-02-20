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
  searchAddress,
  reverseGeocode,
} from '../src/services/maps';
import { stopScheduler } from '../src/services/scheduler';
import { stopQueue } from '../src/services/messageQueue';

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

test('extractCoords извлекает широту и долготу', () => {
  const coords = extractCoords('https://maps.google.com/@10.1,20.2,15z');
  expect(coords).toEqual({ lat: 10.1, lng: 20.2 });
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
