// Назначение: проверка сохранения маски удаления задач при обновлении пользователя
// Основные модули: jest, queries.updateUser, mongoose Types

process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const createFindOneCursor = (access?: number) => ({
  lean: jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(access === undefined ? null : { access }),
  }),
});

jest.mock('../apps/api/src/db/model', () => ({
  User: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  Role: { findById: jest.fn() },
}));

const { Types } = require('mongoose');
const mockRoleId = new Types.ObjectId();

jest.mock('../apps/api/src/db/roleCache', () => ({
  resolveRoleId: jest.fn(async () => mockRoleId),
  clearRoleCache: jest.fn(),
}));

const {
  ACCESS_TASK_DELETE,
  ACCESS_ADMIN,
  ACCESS_MANAGER,
} = require('../apps/api/src/utils/accessMask');
const { updateUser } = require('../apps/api/src/db/queries');
const model = require('../apps/api/src/db/model');
const roleCache = require('../apps/api/src/db/roleCache');

const ADMIN_MASK = ACCESS_ADMIN | ACCESS_MANAGER;

describe('updateUser', () => {
  beforeEach(() => {
    model.User.findOne.mockImplementation(() =>
      createFindOneCursor(ACCESS_TASK_DELETE | ADMIN_MASK),
    );
    model.User.findOneAndUpdate.mockResolvedValue({
      access: ACCESS_TASK_DELETE | ADMIN_MASK,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('сохраняет маску удаления при обновлении роли', async () => {
    roleCache.resolveRoleId.mockResolvedValueOnce(mockRoleId);
    const result = await updateUser('42', { role: 'admin' });
    expect(model.User.findOneAndUpdate).toHaveBeenCalledWith(
      { telegram_id: { $eq: 42 } },
      expect.objectContaining({
        role: 'admin',
        access: ACCESS_TASK_DELETE | ADMIN_MASK,
        roleId: mockRoleId,
      }),
      { new: true },
    );
    expect(result).toEqual({ access: ACCESS_TASK_DELETE | ADMIN_MASK });
  });
});
