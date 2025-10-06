/**
 * Назначение файла: проверка отправки вложений при создании задачи без превью.
 * Основные модули: TasksController, Telegram-бот (моки).
 */
import 'reflect-metadata';
import type { TaskDocument } from '../apps/api/src/db/model';
import TasksController from '../apps/api/src/tasks/tasks.controller';

jest.mock('../apps/api/src/bot/bot', () => {
  const sendMessageMock = jest.fn();
  const sendMediaGroupMock = jest.fn();
  const sendPhotoMock = jest.fn();
  const sendDocumentMock = jest.fn();
  const editMessageTextMock = jest.fn();
  const editMessageMediaMock = jest.fn();
  const editMessageCaptionMock = jest.fn();
  const editMessageReplyMarkupMock = jest.fn();
  const deleteMessageMock = jest.fn();
  return {
    bot: {
      telegram: {
        sendMessage: sendMessageMock,
        sendMediaGroup: sendMediaGroupMock,
        sendPhoto: sendPhotoMock,
        sendDocument: sendDocumentMock,
        editMessageText: editMessageTextMock,
        editMessageMedia: editMessageMediaMock,
        editMessageCaption: editMessageCaptionMock,
        editMessageReplyMarkup: editMessageReplyMarkupMock,
        deleteMessage: deleteMessageMock,
      },
    },
    buildDirectTaskKeyboard: jest.fn(),
    buildDirectTaskMessage: jest.fn(() => ''),
    __sendMessageMock: sendMessageMock,
    __sendMediaGroupMock: sendMediaGroupMock,
    __sendPhotoMock: sendPhotoMock,
    __sendDocumentMock: sendDocumentMock,
    __editMessageTextMock: editMessageTextMock,
    __editMessageMediaMock: editMessageMediaMock,
    __editMessageCaptionMock: editMessageCaptionMock,
    __editMessageReplyMarkupMock: editMessageReplyMarkupMock,
    __deleteMessageMock: deleteMessageMock,
  };
});

const {
  __sendMessageMock: sendMessageMock,
  __sendMediaGroupMock: sendMediaGroupMock,
  __sendPhotoMock: sendPhotoMock,
  __sendDocumentMock: sendDocumentMock,
  __editMessageTextMock: editMessageTextMock,
  __editMessageMediaMock: editMessageMediaMock,
  __editMessageCaptionMock: editMessageCaptionMock,
  __editMessageReplyMarkupMock: editMessageReplyMarkupMock,
  __deleteMessageMock: deleteMessageMock,
} = jest.requireMock('../apps/api/src/bot/bot') as {
  __sendMessageMock: jest.Mock;
  __sendMediaGroupMock: jest.Mock;
  __sendPhotoMock: jest.Mock;
  __sendDocumentMock: jest.Mock;
  __editMessageTextMock: jest.Mock;
  __editMessageMediaMock: jest.Mock;
  __editMessageCaptionMock: jest.Mock;
  __editMessageReplyMarkupMock: jest.Mock;
  __deleteMessageMock: jest.Mock;
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

const { getUsersMap: getUsersMapMock } = jest.requireMock(
  '../apps/api/src/db/queries',
) as { getUsersMap: jest.Mock };

jest.mock('../apps/api/src/db/model', () => {
  const updateTaskMock = jest.fn(() => ({
    exec: jest.fn().mockResolvedValue(undefined),
  }));
  const taskFindByIdMock = jest.fn();
  const fileFindByIdMock = jest.fn();
  const updateOneMock = jest.fn(() => ({
    exec: jest.fn().mockResolvedValue({ matchedCount: 1 }),
  }));
  return {
    Task: {
      findByIdAndUpdate: updateTaskMock,
      findById: taskFindByIdMock,
      updateOne: updateOneMock,
    },
    File: {
      findById: fileFindByIdMock,
    },
    __updateTaskMock: updateTaskMock,
    __taskFindByIdMock: taskFindByIdMock,
    __fileFindByIdMock: fileFindByIdMock,
    __updateOneMock: updateOneMock,
  };
});

const {
  __updateTaskMock: updateTaskMock,
  __taskFindByIdMock: taskFindByIdMock,
  __fileFindByIdMock: fileFindByIdMock,
  __updateOneMock: updateOneMock,
} = jest.requireMock('../apps/api/src/db/model') as {
  __updateTaskMock: jest.Mock;
  __taskFindByIdMock: jest.Mock;
  __fileFindByIdMock: jest.Mock;
  __updateOneMock: jest.Mock;
};

describe('notifyTaskCreated вложения', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendMessageMock.mockReset();
    sendMediaGroupMock.mockReset();
    sendPhotoMock.mockReset();
    sendDocumentMock.mockReset();
    editMessageTextMock.mockReset();
    editMessageMediaMock.mockReset();
    editMessageCaptionMock.mockReset();
    editMessageReplyMarkupMock.mockReset();
    deleteMessageMock.mockReset();
    updateTaskMock.mockClear();
    taskFindByIdMock.mockClear();
    fileFindByIdMock.mockClear();
    updateOneMock.mockClear();
    getUsersMapMock.mockClear();
    process.env.APP_URL = 'https://example.com';
  });

  it('отправляет текст задачи и вложения отдельным альбомом без превью', async () => {
    sendMessageMock
      .mockResolvedValueOnce({ message_id: 301 })
      .mockResolvedValueOnce({ message_id: 401 })
      .mockResolvedValueOnce({ message_id: 501 });

    sendMediaGroupMock.mockResolvedValue([
      { message_id: 211 },
      { message_id: 212 },
    ]);

    const attachments = [
      {
        url: 'https://cdn.example.com/first.jpg',
        type: 'image/jpeg',
        name: 'first.jpg',
      },
      {
        url: 'https://cdn.example.com/second.png',
        type: 'image/png',
        name: 'second.png',
      },
      {
        url: 'https://youtu.be/demo',
        type: 'text/html',
        name: 'Видео',
      },
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
      createdAt: '2024-01-01T00:00:00Z',
      history: [],
      status: 'Новая',
    } as unknown as TaskDocument & { toObject(): unknown };

    (plainTask as unknown as { toObject: () => unknown }).toObject = () => plainTask;

    const controller = new TasksController({} as any);
    await (controller as unknown as { notifyTaskCreated(task: TaskDocument, userId: number): Promise<void> }).notifyTaskCreated(
      plainTask as TaskDocument,
      55,
    );

    expect(sendPhotoMock).not.toHaveBeenCalled();
    expect(sendMediaGroupMock).toHaveBeenCalledTimes(1);
    const [taskMessage] = sendMessageMock.mock.calls;
    expect(taskMessage?.[1]).toContain('Тестовая задача');
    const youtubeCall = sendMessageMock.mock.calls[1];
    expect(youtubeCall?.[1]).toContain('▶️');
    const statusCall = sendMessageMock.mock.calls[2];
    expect(statusCall?.[1]).toContain('создана');

    const mediaPayload = sendMediaGroupMock.mock.calls[0]?.[1];
    expect(Array.isArray(mediaPayload)).toBe(true);
    expect(mediaPayload).toHaveLength(2);
    expect(mediaPayload?.[0]).toMatchObject({ type: 'photo' });

    const updateCall = updateOneMock.mock.calls[0];
    if (updateCall) {
      const updateSet = (updateCall[1]?.$set ?? {}) as Record<string, unknown>;
      expect(updateSet.telegram_preview_message_ids).toBeUndefined();
      expect(updateSet.telegram_attachments_message_ids).toEqual([211, 212]);
    }
  });
});
