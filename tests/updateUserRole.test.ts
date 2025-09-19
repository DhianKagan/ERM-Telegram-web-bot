// Назначение: проверка синхронизации roleId при изменении роли
// Основные модули: jest, mongoose, db/queries, db/model
import { updateUser } from '../apps/api/src/db/queries';
import { Types } from 'mongoose';

const resolveRoleId = jest.fn();

jest.mock('../apps/api/src/db/model', () => ({
  Role: { findOne: jest.fn() },
  User: { findOneAndUpdate: jest.fn() },
}));

jest.mock('../apps/api/src/db/roleCache', () => ({
  resolveRoleId: (name: string) => resolveRoleId(name),
  clearRoleCache: jest.fn(),
}));

const { User } = require('../apps/api/src/db/model');
import { ACCESS_ADMIN, ACCESS_MANAGER } from '../apps/api/src/utils/accessMask';

test('обновляет roleId по названию роли', async () => {
  const id = new Types.ObjectId();
  resolveRoleId.mockResolvedValueOnce(id);
  (User.findOneAndUpdate as jest.Mock).mockResolvedValue({});
  await updateUser(1, { role: 'admin' });
  expect(resolveRoleId).toHaveBeenCalledWith('admin');
  expect(User.findOneAndUpdate).toHaveBeenCalledWith(
    { telegram_id: { $eq: 1 } },
    { role: 'admin', roleId: id, access: ACCESS_ADMIN | ACCESS_MANAGER },
    { new: true },
  );
});
