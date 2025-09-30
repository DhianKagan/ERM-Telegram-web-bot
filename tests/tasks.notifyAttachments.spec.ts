/**
 * Назначение файла: проверка отправки вложений при создании задачи.
 * Основные модули: TasksController, Telegram-бот (моки).
 */
import 'reflect-metadata';
import type { TaskDocument } from '../apps/api/src/db/model';
import TasksController from '../apps/api/src/tasks/tasks.controller';

const escapeMd = (value: string) =>
  value.replace(/[\\_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');

jest.mock('../apps/api/src/bot/bot', () => {
  const sendMessageMock = jest.fn();
  const sendPhotoMock = jest.fn();
  const sendMediaGroupMock = jest.fn();
  return {
    bot: {
      telegram: {
        sendMessage: sendMessageMock,
        sendPhoto: sendPhotoMock,
        sendMediaGroup: sendMediaGroupMock,
      },
    },
    __sendMessageMock: sendMessageMock,
    __sendPhotoMock: sendPhotoMock,
    __sendMediaGroupMock: sendMediaGroupMock,
  };
});

const {
  __sendMessageMock: sendMessageMock,
  __sendPhotoMock: sendPhotoMock,
  __sendMediaGroupMock: sendMediaGroupMock,
} = jest.requireMock('../apps/api/src/bot/bot') as {
  __sendMessageMock: jest.Mock;
  __sendPhotoMock: jest.Mock;
  __sendMediaGroupMock: jest.Mock;
};

jest.mock('../apps/api/src/utils/taskButtons', () =>
  jest.fn(() => ({ inline_keyboard: [] })),
);

jest.mock('../apps/api/src/utils/messageLink', () =>
  jest.fn(() => 'https://t.me/c/100/200'),
);

jest.mock('../apps/api/src/db/queries', () => ({
  getUsersMap: jest.fn(async () => ({ '55': { name: 'Иван', username: 'ivan' } })),
}));

jest.mock('../apps/api/src/db/model', () => {
  const actual = jest.requireActual('../apps/api/src/db/model');
  const updateTaskMock = jest.fn(() => ({
    exec: jest.fn().mockResolvedValue(undefined),
  }));
  return {
    ...actual,
    Task: {
      findByIdAndUpdate: updateTaskMock,
    },
    __updateTaskMock: updateTaskMock,
  };
});

const { __updateTaskMock: updateTaskMock } = jest.requireMock(
  '../apps/api/src/db/model',
) as { __updateTaskMock: jest.Mock };

describe('notifyTaskCreated вложения', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('отправляет изображения медиа-группой и превью YouTube в исходном порядке', async () => {
    const events: string[] = [];
    sendMessageMock.mockImplementation((_chat, text: string) => {
      if (text.startsWith('▶️')) {
        events.push('youtube');
        return Promise.resolve({ message_id: 202 });
      }
      if (text.startsWith('Задача')) {
        events.push('status');
        return Promise.resolve({ message_id: 303 });
      }
      events.push('main');
      return Promise.resolve({ message_id: 101 });
    });
    sendPhotoMock.mockImplementation(() => {
      events.push('photo');
      return Promise.resolve({ message_id: 404 });
    });
    sendMediaGroupMock.mockImplementation(() => {
      events.push('group');
      return Promise.resolve([{ message_id: 505 }]);
    });

    const appBaseUrl = (process.env.APP_URL || 'https://example.com').replace(
      /\/+$/,
      '',
    );

    const attachments = [
      { url: '/api/v1/files/a.jpg', type: 'image/jpeg', name: 'a.jpg' },
      { url: '/files/b.png', type: 'image/png', name: 'b.png' },
      { url: 'https://youtu.be/demo', type: 'text/html', name: 'Видео' },
      { url: '/api/v1/files/c.gif', type: 'image/gif', name: 'c.gif' },
      { url: 'https://example.com/doc.pdf', type: 'application/pdf' },
    ];

    const plainTask = {
      _id: '507f1f77bcf86cd799439011',
      task_number: 'A-12',
      title: 'Тестовая задача',
      attachments,
      telegram_topic_id: 777,
      assignees: [55],
      assigned_user_id: 55,
      created_by: 55,
      request_id: 'REQ-1',
      createdAt: '2024-01-01T00:00:00Z',
    };

    const task = {
      ...plainTask,
      toObject() {
        return { ...plainTask } as unknown as TaskDocument;
      },
    } as unknown as TaskDocument;

    const controller = new TasksController({} as any);

    await (controller as any).notifyTaskCreated(task, 55);

    expect(events).toEqual(['main', 'group', 'youtube', 'photo', 'status']);
    expect(sendMediaGroupMock).toHaveBeenCalledTimes(1);
    const mediaArgs = sendMediaGroupMock.mock.calls[0];
    expect(mediaArgs[1]).toEqual([
      { type: 'photo', media: `${appBaseUrl}/api/v1/files/a.jpg` },
      { type: 'photo', media: `${appBaseUrl}/files/b.png` },
    ]);
    expect(mediaArgs[2]).toMatchObject({
      message_thread_id: 777,
      reply_parameters: {
        message_id: 101,
        allow_sending_without_reply: true,
      },
    });

    const [, youtubeText, youtubeOptions] = sendMessageMock.mock.calls[1];
    const expectedYoutubeText = `▶️ [${escapeMd('Видео')}](${escapeMd(
      'https://youtu.be/demo',
    )})`;
    expect(youtubeText).toBe(expectedYoutubeText);
    expect(youtubeOptions).toMatchObject({
      parse_mode: 'MarkdownV2',
      reply_parameters: {
        allow_sending_without_reply: true,
        message_id: 101,
      },
    });

    expect(sendPhotoMock).toHaveBeenCalledWith(
      expect.anything(),
      `${appBaseUrl}/api/v1/files/c.gif`,
      expect.objectContaining({
        reply_parameters: {
          message_id: 101,
          allow_sending_without_reply: true,
        },
      }),
    );

    expect(updateTaskMock).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
      telegram_message_id: 101,
      telegram_status_message_id: 303,
    });
  });
});

