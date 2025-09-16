// Назначение: автотесты. Модули: jest, supertest.
// Тест функции createUser
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const createCursor = () => ({
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(null),
});

const findOneMock = jest.fn(createCursor);

jest.mock('../src/db/model', () => ({
  User: {
    create: jest.fn(async (doc) => doc),
    exists: jest.fn(async () => false),
    findOne: findOneMock,
  },
  Role: { findById: jest.fn(async () => null) },
}));

const { createUser } = require('../src/db/queries');
const config = require('../src/config');
const model = require('../src/db/model');

describe('createUser', () => {
  beforeEach(() => {
    findOneMock.mockReset();
    findOneMock.mockImplementation(createCursor);
  });

  test('новый пользователь получает имя из username', async () => {
    model.User.create = jest.fn(async (doc) => doc);
    model.User.exists = jest.fn(async () => false);
    const u = await createUser(1, 'test');
    expect(u.name).toBe('test');
    expect(u.roleId).toBe(config.userRoleId);
  });

  test('генерирует id и username при пустом вводе', async () => {
    model.User.exists = jest
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(false);
    findOneMock.mockReturnValueOnce({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({ telegram_id: 10 }),
    });
    const result = await require('../src/db/queries').generateUserCredentials();
    expect(result.telegramId).toBe(11);
    expect(result.username).toBe('employee11');
  });
});
