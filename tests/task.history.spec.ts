// Назначение: проверка формирования истории задач
// Основные модули: jest, db/queries, db/model
import { updateTask } from '../apps/api/src/db/queries';
import { Types } from 'mongoose';

jest.mock('../apps/api/src/db/model', () => ({
  Task: { findById: jest.fn(), findByIdAndUpdate: jest.fn() },
}));

const { Task } = require('../apps/api/src/db/model');

test('сохраняет diff и пользователя', async () => {
  const id = String(new Types.ObjectId());
  (Task.findById as jest.Mock).mockResolvedValue({ status: 'Новая' });
  (Task.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
  await updateTask(id, { status: 'В работе' }, 42);
  expect(Task.findById).toHaveBeenCalledWith(id);
  expect(Task.findByIdAndUpdate).toHaveBeenCalledWith(
    id,
    expect.objectContaining({
      $set: {
        status: 'В работе',
      },
      $push: {
        history: expect.objectContaining({
          changed_by: 42,
          changes: {
            from: expect.objectContaining({ status: 'Новая' }),
            to: expect.objectContaining({
              status: 'В работе',
            }),
          },
          changed_at: expect.any(Date),
        }),
      },
    }),
    { new: true },
  );
});
