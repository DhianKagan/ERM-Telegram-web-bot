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
    buildTaskAppLink: jest.fn(() => 'https://example.com/tasks?task=507f1f77bcf86cd799439011'),
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
      findOneAndUpdate: updateTaskMock,
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

  it('отправляет текст задачи и вложения альбомом с кнопками в основном сообщении', async () => {
    const groupMessageId = 311;
    const youtubeMessageId = 322;
    sendMediaGroupMock.mockResolvedValueOnce([
      { message_id: 301 },
      { message_id: 302 },
    ]);
    sendMessageMock.mockResolvedValueOnce({ message_id: groupMessageId });
    sendMessageMock.mockResolvedValueOnce({ message_id: youtubeMessageId });

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

    expect(sendMediaGroupMock).toHaveBeenCalledTimes(1);
    expect(sendPhotoMock).not.toHaveBeenCalled();

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    const youtubeCall = sendMessageMock.mock.calls.find((call) =>
      typeof call?.[1] === 'string' && call[1].includes('▶️'),
    );
    expect(youtubeCall?.[1]).toContain('▶️');

    const updateCall = updateTaskMock.mock.calls[0];
    if (updateCall) {
      const updatePayload = (updateCall[1] ?? {}) as {
        $set?: Record<string, unknown>;
        $unset?: Record<string, unknown>;
      };
      expect(updatePayload.$set?.telegram_message_id).toBe(groupMessageId);
      expect(updatePayload.$set?.telegram_preview_message_ids).toEqual([301, 302]);
      expect(
        updatePayload.$set?.telegram_attachments_message_ids,
      ).toEqual(expect.arrayContaining([youtubeMessageId]));
    }
  });

  it('удаляет и пересоздаёт сообщения и вложения при обновлении задачи', async () => {
    const previewMessageId = 612;
    const groupMessageId = 702;
    const directMessageId = 713;
    sendPhotoMock.mockResolvedValueOnce({ message_id: previewMessageId });
    sendMessageMock.mockResolvedValueOnce({ message_id: groupMessageId });
    sendMessageMock.mockResolvedValueOnce({ message_id: directMessageId });

    const previousTask = {
      _id: '507f1f77bcf86cd799439011',
      telegram_message_id: 501,
      telegram_topic_id: 777,
      telegram_attachments_message_ids: [311],
      telegram_history_message_id: 401,
      assignees: [55, 77],
      assigned_user_id: 55,
      created_by: 55,
      history: [],
      status: 'Новая',
    } as unknown as TaskDocument & Record<string, unknown>;

    const updatedTask = {
      ...previousTask,
      attachments: [
        {
          url: 'https://cdn.example.com/after.jpg',
          type: 'image/jpeg',
          name: 'after.jpg',
        },
      ],
      toObject() {
        return this;
      },
    } as unknown as TaskDocument & { toObject(): unknown };

    taskFindByIdMock.mockResolvedValue(updatedTask);

    const controller = new TasksController({} as any);
    await (
      controller as unknown as {
        broadcastTaskSnapshot(
          task: TaskDocument,
          actorId: number,
          options?: {
            previous?: TaskDocument | null;
            action?: 'создана' | 'обновлена';
            note?: string | null;
          },
        ): Promise<void>;
      }
    ).broadcastTaskSnapshot(updatedTask, 77, {
      previous: previousTask,
      action: 'обновлена',
    });

    expect(deleteMessageMock).toHaveBeenCalledWith(expect.any(String), 501);
    expect(deleteMessageMock).toHaveBeenCalledWith(expect.any(String), 311);
    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    expect(sendPhotoMock).toHaveBeenCalledTimes(1);
    const updateCall = updateTaskMock.mock.calls[0];
    if (updateCall) {
      const updatePayload = (updateCall[1] ?? {}) as {
        $set?: Record<string, unknown>;
        $unset?: Record<string, unknown>;
      };
      expect(updatePayload.$set?.telegram_message_id).toBe(groupMessageId);
      expect(updatePayload.$set?.telegram_preview_message_ids).toEqual([
        previewMessageId,
      ]);
      expect(updatePayload.$set?.telegram_history_message_id).toBeUndefined();
      expect(updatePayload.$unset?.telegram_history_message_id).toBe('');
      expect(updatePayload.$unset?.telegram_attachments_message_ids).toBe('');
      expect(updatePayload.$set?.telegram_dm_message_ids).toEqual([
        { user_id: 55, message_id: directMessageId },
      ]);
      expect(updatePayload.$unset?.telegram_message_cleanup).toBe('');
    }
  });
});
