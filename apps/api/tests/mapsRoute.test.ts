// Назначение: автотесты. Модули: jest, supertest, shared.
// Тест маршрута /api/maps/expand
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

import express from 'express';
import request from 'supertest';
import { stopScheduler } from '../src/services/scheduler';
import { stopQueue } from '../src/services/messageQueue';

jest.mock('../src/services/maps', () => ({
  expandMapsUrl: jest.fn(async () => 'https://maps.google.com/full'),
  extractPlaceDetailsViaPlaywright: jest.fn(async () => null),
  searchAddress: jest.fn(async () => []),
}));
jest.mock('shared', () => ({
  ...jest.requireActual('shared'),
  extractCoords: jest.fn(() => ({ lat: 1, lng: 2 })),
}));
jest.mock('../src/services/shortLinks', () => ({
  ensureShortLink: jest.fn(async () => ({
    shortUrl: 'https://localhost/l/demo',
    slug: 'demo',
  })),
  resolveShortLink: jest.fn(async () => null),
  isShortLink: jest.fn(() => false),
}));
jest.mock('../src/services/taskLinks', () => ({
  normalizeManagedShortLink: jest.fn((value: string) => value),
}));

jest.mock('../src/middleware/auth', () =>
  jest.fn(() => (_req, _res, next) => next()),
);

jest.mock('../src/api/middleware', () => ({
  verifyToken: (_req, _res, next) => next(),
  asyncHandler: (fn: unknown) => fn,
  errorHandler: (err: Error, _req: unknown, res: express.Response) =>
    res.status(500).json({ error: err.message }),
}));

import router from '../src/routes/maps';
import {
  expandMapsUrl,
  extractPlaceDetailsViaPlaywright,
  searchAddress,
} from '../src/services/maps';
import { extractCoords } from 'shared';
import {
  ensureShortLink,
  resolveShortLink,
  isShortLink,
} from '../src/services/shortLinks';
import { normalizeManagedShortLink } from '../src/services/taskLinks';

let app: express.Express;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/v1/maps', router);
});

beforeEach(() => {
  jest.clearAllMocks();
  (expandMapsUrl as jest.Mock).mockResolvedValue(
    'https://maps.google.com/full',
  );
  (extractPlaceDetailsViaPlaywright as jest.Mock).mockResolvedValue(null);
  (searchAddress as jest.Mock).mockResolvedValue([]);
  (extractCoords as jest.Mock).mockImplementation((value: string) =>
    value === 'https://maps.google.com/full' ? { lat: 1, lng: 2 } : null,
  );
  (isShortLink as jest.Mock).mockReturnValue(false);
  (resolveShortLink as jest.Mock).mockResolvedValue(null);
  (ensureShortLink as jest.Mock).mockResolvedValue({
    shortUrl: 'https://localhost/l/demo',
    slug: 'demo',
  });
  (normalizeManagedShortLink as jest.Mock).mockImplementation(
    (value: string) => value,
  );
});

test('POST /api/v1/maps/expand возвращает url и coords', async () => {
  const res = await request(app).post('/api/v1/maps/expand').send({ url: 'u' });
  expect(res.body.url).toBe('https://maps.google.com/full');
  expect(res.body.coords).toEqual({ lat: 1, lng: 2 });
  expect(expandMapsUrl).toHaveBeenCalledWith('u');
  expect(ensureShortLink).toHaveBeenCalledWith('https://maps.google.com/full');
  expect(res.body.short).toBe('https://localhost/l/demo');
  expect(isShortLink).toHaveBeenCalledWith('u');
  expect(resolveShortLink).not.toHaveBeenCalled();
});

test('POST /api/v1/maps/expand обрабатывает управляемую короткую ссылку', async () => {
  (isShortLink as jest.Mock).mockReturnValueOnce(true);
  (resolveShortLink as jest.Mock).mockResolvedValueOnce(
    'https://maps.google.com/expanded',
  );
  const res = await request(app)
    .post('/api/v1/maps/expand')
    .send({ url: 'https://localhost/l/demo' });
  expect(resolveShortLink).toHaveBeenCalledWith('https://localhost/l/demo');
  expect(expandMapsUrl).toHaveBeenCalledWith(
    'https://maps.google.com/expanded',
  );
  expect(res.body.short).toBe('https://localhost/l/demo');
  expect(normalizeManagedShortLink).toHaveBeenCalledWith(
    'https://localhost/l/demo',
  );
});

test('POST /api/v1/maps/expand подбирает координаты через searchAddress когда в URL нет координат', async () => {
  (expandMapsUrl as jest.Mock).mockResolvedValue(
    'https://www.google.com/maps/place/Київ',
  );
  (extractPlaceDetailsViaPlaywright as jest.Mock).mockResolvedValue({
    name: 'Київ',
    address: 'Київ, Україна',
  });
  (searchAddress as jest.Mock).mockResolvedValue([
    {
      id: '1',
      label: 'Київ',
      lat: 50.4501,
      lng: 30.5234,
      source: 'nominatim',
    },
  ]);
  (extractCoords as jest.Mock).mockImplementation((value: string) =>
    value.includes('query=50.4501,30.5234')
      ? { lat: 50.4501, lng: 30.5234 }
      : null,
  );

  const res = await request(app)
    .post('/api/v1/maps/expand')
    .send({ url: 'https://maps.app.goo.gl/5RESMr48ropZkVYs8' });

  expect(searchAddress).toHaveBeenCalledWith('Київ', { limit: 1 });
  expect(res.body.url).toBe(
    'https://www.google.com/maps/search/?api=1&query=50.4501,30.5234',
  );
  expect(res.body.coords).toEqual({ lat: 50.4501, lng: 30.5234 });
});

test('POST /api/v1/maps/expand не вызывает headless fallback когда координаты уже есть в URL', async () => {
  (expandMapsUrl as jest.Mock).mockResolvedValue(
    'https://www.google.com/maps/@46.459854,30.546979,17z',
  );
  (extractCoords as jest.Mock).mockImplementation((value: string) =>
    value.includes('@46.459854,30.546979')
      ? { lat: 46.459854, lng: 30.546979 }
      : null,
  );

  const res = await request(app)
    .post('/api/v1/maps/expand')
    .send({ url: 'https://maps.app.goo.gl/h4DvKu4FwHBpfnJz9' });

  expect(res.body.coords).toEqual({ lat: 46.459854, lng: 30.546979 });
  expect(extractPlaceDetailsViaPlaywright).not.toHaveBeenCalled();
});
test('POST /api/v1/maps/expand берет название места из URL без headless fallback', async () => {
  (expandMapsUrl as jest.Mock).mockResolvedValue(
    'https://www.google.com/maps/place/AGROMARKET/@46.392470,30.703428,17z',
  );
  (extractCoords as jest.Mock).mockImplementation((value: string) =>
    value.includes('@46.392470,30.703428')
      ? { lat: 46.39247, lng: 30.703428 }
      : null,
  );

  const res = await request(app)
    .post('/api/v1/maps/expand')
    .send({ url: 'https://maps.app.goo.gl/fr1VNAH7RiVbY1vQ9' });

  expect(res.body.url).toBe(
    'https://www.google.com/maps/place/AGROMARKET/@46.392470,30.703428,17z',
  );
  expect(res.body.coords).toEqual({ lat: 46.39247, lng: 30.703428 });
  expect(res.body.place).toEqual({ name: 'AGROMARKET' });
  expect(extractPlaceDetailsViaPlaywright).not.toHaveBeenCalled();
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
