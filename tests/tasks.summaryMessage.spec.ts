/**
 * Назначение файла: проверка обновления краткого сообщения задачи без создания дублей.
 * Основные модули: TasksController, Telegram-бот (моки).
 */
import 'reflect-metadata';
import TasksController from '../apps/api/src/tasks/tasks.controller';

jest.mock('../apps/api/src/bot/bot', () => {
  const editMessageTextMock = jest.fn();
  const sendMessageMock = jest.fn();
  return {
    bot: {
      telegram: {
        editMessageText: editMessageTextMock,
        sendMessage: sendMessageMock,
      },
    },
    buildTaskAppLink: jest.fn(() => null),
    buildDirectTaskKeyboard: jest.fn(() => null),
    buildDirectTaskMessage: jest.fn(() => ''),
    __editMessageTextMock: editMessageTextMock,
    __sendMessageMock: sendMessageMock,
  };
});

jest.mock('../apps/api/src/db/queries', () => ({
  getUsersMap: jest.fn(async () => ({ 101: { name: 'Алексей', username: 'alexey' } })),
}));

jest.mock('../apps/api/src/tasks/taskHistory.service', () => ({
  updateTaskSummaryMessageId: jest.fn(async () => true),
  updateTaskHistoryMessageId: jest.fn(),
  getTaskHistoryMessage: jest.fn(),
}));

const { __editMessageTextMock: editMessageTextMock, __sendMessageMock: sendMessageMock } =
  jest.requireMock('../apps/api/src/bot/bot') as {
    __editMessageTextMock: jest.Mock;
    __sendMessageMock: jest.Mock;
  };

const { updateTaskSummaryMessageId: updateTaskSummaryMessageIdMock } = jest.requireMock(
  '../apps/api/src/tasks/taskHistory.service',
) as {
  updateTaskSummaryMessageId: jest.Mock;
};

describe('updateTaskStatusSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CHAT_ID = '-100200';
  });

  it('не создаёт новое сообщение при ответе message is not modified', async () => {
    const controller = new TasksController({} as any);
    type TaskStub = {
      _id: string;
      task_number: string;
      telegram_summary_message_id: number;
      telegram_message_id: number;
      history: Array<{
        changed_at: string;
        changed_by: number;
        changes: {
          from: { status: string };
          to: { status: string };
        };
      }>;
    };

    const task: TaskStub = {
      _id: '507f1f77bcf86cd799439011',
      task_number: 'ERM-100',
      telegram_summary_message_id: 321,
      telegram_message_id: 654,
      history: [
        {
          changed_at: '2024-01-01T10:00:00.000Z',
          changed_by: 101,
          changes: {
            from: { status: 'Новая' },
            to: { status: 'В работе' },
          },
        },
      ],
    };

    const notModifiedError = Object.assign(new Error('Bad Request: message is not modified'), {
      response: { error_code: 400, description: 'Bad Request: message is not modified' },
    });

    editMessageTextMock.mockRejectedValueOnce(notModifiedError);

    await (controller as unknown as {
      updateTaskStatusSummary(task: TaskStub): Promise<void>;
    }).updateTaskStatusSummary(task);

    expect(editMessageTextMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(updateTaskSummaryMessageIdMock).not.toHaveBeenCalled();
  });
});

