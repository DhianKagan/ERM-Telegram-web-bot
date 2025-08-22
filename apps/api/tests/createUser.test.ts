// Назначение: автотесты. Модули: jest, supertest.
// Тест функции createUser
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

jest.mock('../src/db/model', () => ({
  User: { create: jest.fn(async (doc) => doc) },
  Role: { findById: jest.fn(async () => null) },
}));

const { createUser } = require('../src/db/queries');
const config = require('../src/config');
const model = require('../src/db/model');

describe('createUser', () => {
  test('новый пользователь получает имя из username', async () => {
    model.User.create = jest.fn(async (doc) => doc);
    const u = await createUser(1, 'test');
    expect(u.name).toBe('test');
    expect(u.roleId).toBe(config.userRoleId);
  });
});
