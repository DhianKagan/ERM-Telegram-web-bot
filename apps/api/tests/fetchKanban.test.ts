// Назначение: автотесты. Модули: jest, supertest.
// Проверяем работу fetchKanban: корректный разбор ответа
export {};

process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.JWT_SECRET = 's';
process.env.APP_URL = 'https://localhost';

const { fetchKanban } = require('../../web/src/services/tasks');

type GlobalWithMocks = typeof globalThis & Record<string, unknown>;

const testGlobal = global as GlobalWithMocks;
const originalFetch = testGlobal.fetch;

afterAll(() => {
  if (originalFetch) {
    testGlobal.fetch = originalFetch;
  } else {
    Reflect.deleteProperty(testGlobal, 'fetch');
  }
  Reflect.deleteProperty(testGlobal, 'localStorage');
  Reflect.deleteProperty(testGlobal, 'window');
});

beforeEach(() => {
  testGlobal.localStorage = {
    length: 0,
    clear: jest.fn(),
    getItem: jest.fn().mockReturnValue('t'),
    key: jest.fn(),
    removeItem: jest.fn(),
    setItem: jest.fn(),
  } as unknown as Storage;
  testGlobal.window = { location: { href: '' } } as unknown as Window &
    typeof globalThis;
});

test('fetchKanban извлекает tasks из объекта', async () => {
  testGlobal.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({ tasks: [{ _id: '1', status: 'Новая', title: 't' }] }),
  }) as unknown as typeof fetch;
  const list = await fetchKanban();
  expect(Array.isArray(list)).toBe(true);
  expect(list[0].title).toBe('t');
});

test('fetchKanban принимает массив как есть', async () => {
  testGlobal.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([{ _id: '1' }]),
  }) as unknown as typeof fetch;
  const list = await fetchKanban();
  expect(list).toHaveLength(1);
});
