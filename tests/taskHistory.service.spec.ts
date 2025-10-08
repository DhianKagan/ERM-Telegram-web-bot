// Назначение: проверка форматирования истории задачи для Telegram
// Основные модули: jest, taskHistory.service, db/model
import { getTaskHistoryMessage } from '../apps/api/src/tasks/taskHistory.service';

jest.mock('../apps/api/src/db/model', () => ({
  Task: {
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

jest.mock('../apps/api/src/db/queries', () => ({
  getUsersMap: jest.fn(),
}));

const { Task } = require('../apps/api/src/db/model');
const { getUsersMap } = require('../apps/api/src/db/queries');

function hasInvalidTelegramEscapes(text: string): boolean {
  const allowed = '_*[]()~`>#+-=|{}.!\\';
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\\') {
      const next = text[i + 1];
      if (!next || !allowed.includes(next)) {
        return true;
      }
    }
  }
  return false;
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('возвращает сообщение истории со статусом, деталями и автором', async () => {
  const lean = jest.fn().mockResolvedValue({
    telegram_history_message_id: 555,
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
    '• 12.03.2024 12:15 (GMT+3) — статус: «Новая» → «Выполнена» — [Имя](tg://user?id=77)',
  );
});

test('для обновления срока отправляет короткое сообщение и безопасный Markdown', async () => {
  const lean = jest.fn().mockResolvedValue({
    telegram_history_message_id: null,
    history: [
      {
        changed_at: new Date('2023-11-02T12:30:00Z'),
        changed_by: 0,
        changes: {
          from: { deadline: '2023-11-01T10:00:00Z' },
          to: { deadline: '2023-11-02T12:30:00Z' },
        },
      },
    ],
  });
  (Task.findById as jest.Mock).mockReturnValue({ lean });
  (getUsersMap as jest.Mock).mockResolvedValue({});

  const result = await getTaskHistoryMessage('deadline-update');

  expect(result).not.toBeNull();
  const text = result?.text ?? '';
  expect(text).toContain('— задачу обновил Система');
  expect(text).not.toContain('срок:');
  expect(hasInvalidTelegramEscapes(text)).toBe(false);
});

test('для текстового обновления использует короткое сообщение и ссылку на автора', async () => {
  const lean = jest.fn().mockResolvedValue({
    telegram_history_message_id: null,
    history: [
      {
        changed_at: new Date('2025-09-30T20:44:00Z'),
        changed_by: 123,
        changes: {
          from: { title: 'Старая *версия* #A' },
          to: { title: 'Новая версия + улучшения' },
        },
      },
    ],
  });
  (Task.findById as jest.Mock).mockReturnValue({ lean });
  (getUsersMap as jest.Mock).mockResolvedValue({
    123: { name: 'Исполнитель', username: 'user123' },
  });

  const result = await getTaskHistoryMessage('with-dots');

  expect(result).not.toBeNull();
  const text = result?.text ?? '';
  expect(text).toContain('30\\.09\\.2025 23:44');
  expect(hasInvalidTelegramEscapes(text)).toBe(false);
  const normalized = text.replace(/\\/g, '');
  expect(normalized).toContain(
    '• 30.09.2025 23:44 (GMT+3) — задачу обновил [Исполнитель](tg://user?id=123)',
  );
  expect(normalized).not.toContain('название:');
});
