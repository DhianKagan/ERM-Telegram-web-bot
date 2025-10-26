// Назначение: автотесты. Модули: jest, supertest.
// Тесты формирования URL сервисом маршрутов
export {};

process.env.ROUTING_URL = 'https://localhost:8000/route';
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const { table, nearest } = require('../src/services/route');
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

type FetchMock = jest.Mock<
  Promise<{ ok: boolean; json: () => Promise<Record<string, unknown>> }>,
  [RequestInfo | URL, RequestInit?]
>;

const assignFetchMock = (mock: FetchMock) => {
  (global as typeof globalThis & { fetch?: typeof fetch }).fetch =
    mock as unknown as typeof fetch;
};

afterEach(() => {
  jest.resetAllMocks();
});
afterAll(() => {
  stopScheduler();
  stopQueue();
});

test('table формирует корректный адрес', async () => {
  const fetchMock: FetchMock = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({}) });
  assignFetchMock(fetchMock);
  await table('1,1;2,2', { annotations: 'distance' });
  const calledUrl = fetchMock.mock.calls[0]?.[0];
  expect(typeof calledUrl === 'string' || calledUrl instanceof URL).toBe(true);
  const url = new URL(String(calledUrl));
  expect(url.pathname).toBe('/table');
  expect(url.searchParams.get('points')).toBe('1,1;2,2');
  expect(url.searchParams.get('annotations')).toBe('distance');
});

test('nearest использует параметр point', async () => {
  const fetchMock: FetchMock = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({}) });
  assignFetchMock(fetchMock);
  await nearest('1,1', { number: 1 });
  const calledUrl = fetchMock.mock.calls[0]?.[0];
  expect(typeof calledUrl === 'string' || calledUrl instanceof URL).toBe(true);
  const url = new URL(String(calledUrl));
  expect(url.pathname).toBe('/nearest');
  expect(url.searchParams.get('point')).toBe('1,1');
  expect(url.searchParams.get('number')).toBe('1');
});
