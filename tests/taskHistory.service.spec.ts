// Назначение: проверка форматирования истории задачи для Telegram
// Основные модули: jest, taskHistory.service, db/model
import { getTaskHistoryMessage } from '../apps/api/src/tasks/taskHistory.service';

jest.mock('../apps/api/src/db/model', () => ({
  Task: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock('../apps/api/src/db/queries', () => ({
  getUsersMap: jest.fn(),
}));

const { Task } = require('../apps/api/src/db/model');
const { getUsersMap } = require('../apps/api/src/db/queries');

beforeEach(() => {
  jest.clearAllMocks();
});

test('возвращает сообщение истории со временем, действием и автором', async () => {
  const lean = jest.fn().mockResolvedValue({
    telegram_status_message_id: 555,
    telegram_topic_id: 42,
    history: [
      {
        changed_at: new Date('2024-03-12T10:15:00Z'),
        changed_by: 77,
        changes: {
          from: { status: 'Новая' },
          to: { status: 'Выполнена' },
        },
      },
    ],
  });
  (Task.findById as jest.Mock).mockReturnValue({ lean });
  (getUsersMap as jest.Mock).mockResolvedValue({
    77: { name: 'Имя', username: 'user77' },
  });

  const result = await getTaskHistoryMessage('abc123');

  expect(Task.findById).toHaveBeenCalledWith('abc123');
  expect(getUsersMap).toHaveBeenCalledWith([77]);
  expect(result).toEqual(
    expect.objectContaining({
      taskId: 'abc123',
      messageId: 555,
      topicId: 42,
    }),
  );
  expect(result?.text).toContain('*История изменений*');
  const normalized = result?.text.replace(/\\/g, '');
  expect(normalized).toContain(
    '12.03.2024 12:15 (GMT+3) — статус: «Новая» → «Выполнена» — [Имя](tg://user?id=77)',
  );
});
