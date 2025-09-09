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
  beforeEach(() => {
    model.Role.findById = jest.fn(async () => null);
    model.User.create = jest.fn(async (doc) => doc);
  });

  test('новый пользователь получает роль user и access 1', async () => {
    const u = await createUser(1, 'test');
    expect(u.name).toBe('test');
    expect(u.role).toBe('user');
    expect(u.access).toBe(1);
    expect(u.roleId).toBe(config.userRoleId);
  });

  test('админ получает access 2', async () => {
    model.Role.findById = jest.fn(async () => ({
      _id: config.adminRoleId,
      name: 'admin',
    }));
    const u = await createUser(2, 'admin', config.adminRoleId);
    expect(u.role).toBe('admin');
    expect(u.access).toBe(2);
    expect(u.roleId).toBe(config.adminRoleId);
  });

  test('менеджер получает access 4', async () => {
    model.Role.findById = jest.fn(async () => ({
      _id: config.managerRoleId,
      name: 'manager',
    }));
    const u = await createUser(3, 'manager', config.managerRoleId);
    expect(u.role).toBe('manager');
    expect(u.access).toBe(4);
    expect(u.roleId).toBe(config.managerRoleId);
  });
});
