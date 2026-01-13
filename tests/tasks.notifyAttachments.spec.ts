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
    buildTaskAppLink: jest.fn(
      () => 'https://example.com/tasks?task=507f1f77bcf86cd799439011',
    ),
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

jest.mock('../apps/api/src/utils/taskButtons', () => {
  const taskStatusKeyboardMock = jest.fn(() => ({ inline_keyboard: [] }));
  const taskStatusInlineMarkupMock = jest.fn(
    (
      _id: string,
      _status?: string,
      _options?: unknown,
      extras?: { albumLink?: string },
    ) => ({
      inline_keyboard: extras?.albumLink
        ? [[{ text: 'Фотоальбом', url: extras.albumLink }]]
        : [],
    }),
  );

  return {
    __esModule: true,
    default: taskStatusKeyboardMock,
    taskStatusInlineMarkup: taskStatusInlineMarkupMock,
    __taskStatusKeyboardMock: taskStatusKeyboardMock,
    __taskStatusInlineMarkupMock: taskStatusInlineMarkupMock,
  };
});

const {
  __taskStatusKeyboardMock: taskStatusKeyboardMock,
  __taskStatusInlineMarkupMock: taskStatusInlineMarkupMock,
} = jest.requireMock('../apps/api/src/utils/taskButtons') as {
  __taskStatusKeyboardMock: jest.Mock;
  __taskStatusInlineMarkupMock: jest.Mock;
};

jest.mock('../apps/api/src/utils/messageLink', () =>
  jest.fn(() => 'https://t.me/c/100/200'),
);

jest.mock('../apps/api/src/db/queries', () => ({
  getUsersMap: jest.fn(async () => ({
    '55': { name: 'Иван', username: 'ivan', is_bot: false },
  })),
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
  const userUpdateOneMock = jest.fn(() => ({
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
    User: {
      updateOne: userUpdateOneMock,
    },
    __updateTaskMock: updateTaskMock,
    __taskFindByIdMock: taskFindByIdMock,
    __fileFindByIdMock: fileFindByIdMock,
    __updateOneMock: updateOneMock,
    __userUpdateOneMock: userUpdateOneMock,
  };
});

const {
  __updateTaskMock: updateTaskMock,
  __taskFindByIdMock: taskFindByIdMock,
  __fileFindByIdMock: fileFindByIdMock,
  __updateOneMock: updateOneMock,
  __userUpdateOneMock: userUpdateOneMock,
} = jest.requireMock('../apps/api/src/db/model') as {
  __updateTaskMock: jest.Mock;
  __taskFindByIdMock: jest.Mock;
  __fileFindByIdMock: jest.Mock;
  __updateOneMock: jest.Mock;
  __userUpdateOneMock: jest.Mock;
};

const buildChatMessageLinkMock = jest.requireMock(
  '../apps/api/src/utils/messageLink',
) as jest.Mock;

jest.mock('../apps/api/src/services/taskTypeSettings', () => ({
  resolveTaskTypePhotosTarget: jest.fn(async () => null),
}));

const { resolveTaskTypePhotosTarget: resolvePhotosTargetMock } =
  jest.requireMock('../apps/api/src/services/taskTypeSettings') as {
    resolveTaskTypePhotosTarget: jest.Mock;
  };

const createController = () =>
  new TasksController(
    {} as unknown as ConstructorParameters<typeof TasksController>[0],
  );

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
    taskStatusKeyboardMock.mockReset();
    taskStatusInlineMarkupMock.mockReset();
    taskStatusKeyboardMock.mockImplementation(() => ({ inline_keyboard: [] }));
    taskStatusInlineMarkupMock.mockImplementation(
      (
        _id: string,
        _status?: string,
        _options?: unknown,
        extras?: { albumLink?: string },
      ) => ({
        inline_keyboard: extras?.albumLink
          ? [[{ text: 'Фотоальбом', url: extras.albumLink }]]
          : [],
      }),
    );
    updateTaskMock.mockClear();
    taskFindByIdMock.mockClear();
    fileFindByIdMock.mockClear();
    updateOneMock.mockClear();
    userUpdateOneMock.mockClear();
    getUsersMapMock.mockClear();
    buildChatMessageLinkMock.mockClear();
    process.env.APP_URL = 'https://example.com';
    process.env.CHAT_ID = '-100100';
    resolvePhotosTargetMock.mockReset();
    resolvePhotosTargetMock.mockResolvedValue(null);
  });

  it('отправляет текст задачи и вложения альбомом с кнопками в основном сообщении', async () => {
    const groupMessageId = 311;
    const youtubeMessageId = 322;
    const commentMessageId = 333;
    sendMediaGroupMock.mockResolvedValueOnce([
      { message_id: 301 },
      { message_id: 302 },
    ]);
    sendMessageMock.mockResolvedValueOnce({ message_id: groupMessageId });
    sendMessageMock.mockResolvedValueOnce({ message_id: youtubeMessageId });
    sendMessageMock.mockResolvedValueOnce({ message_id: commentMessageId });

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

    (plainTask as unknown as { toObject: () => unknown }).toObject = () =>
      plainTask;

    const controller = createController();
    await (
      controller as unknown as {
        notifyTaskCreated(task: TaskDocument, userId: number): Promise<void>;
      }
    ).notifyTaskCreated(plainTask as TaskDocument, 55);

    expect(sendMediaGroupMock).toHaveBeenCalledTimes(1);
    expect(sendPhotoMock).not.toHaveBeenCalled();

    expect(sendMessageMock).toHaveBeenCalledTimes(3);
    const youtubeCall = sendMessageMock.mock.calls.find(
      (call) => typeof call?.[1] === 'string' && call[1].includes('▶️'),
    );
    expect(youtubeCall?.[1]).toContain('▶️');
    const commentCall = sendMessageMock.mock.calls.find(
      (call) =>
        typeof call?.[1] === 'string' && call[1].includes('💬 *Комментарий*'),
    );
    expect(commentCall?.[1]).toContain('Нет комментариев');
    expect(commentCall?.[2]?.reply_parameters?.message_id).toBe(groupMessageId);

    const updateCall =
      updateTaskMock.mock.calls.find(
        (call) =>
          (call?.[1] as { $set?: Record<string, unknown> } | undefined)?.$set
            ?.telegram_photos_chat_id !== undefined,
      ) ?? updateTaskMock.mock.calls[updateTaskMock.mock.calls.length - 1];
    if (updateCall) {
      const updatePayload = (updateCall[1] ?? {}) as {
        $set?: Record<string, unknown>;
        $unset?: Record<string, unknown>;
      };
      expect(updatePayload.$set?.telegram_message_id).toBe(groupMessageId);
      expect(updatePayload.$set?.telegram_preview_message_ids).toEqual([
        301, 302,
      ]);
      expect(updatePayload.$set?.telegram_attachments_message_ids).toEqual(
        expect.arrayContaining([youtubeMessageId]),
      );
      expect(updatePayload.$set?.telegram_comment_message_id).toBe(
        commentMessageId,
      );
    }

    const markupCall = editMessageReplyMarkupMock.mock.calls.find(
      (call) => call?.[1] === groupMessageId,
    );
    expect(markupCall?.[3]?.inline_keyboard?.[0]?.[0]).toEqual({
      text: 'Фотоальбом',
      url: 'https://t.me/c/100/200',
    });
  });

  it('удаляет и пересоздаёт сообщения и вложения при обновлении задачи', async () => {
    const previewMessageId = 612;
    const groupMessageId = 702;
    const directMessageId = 713;
    const commentMessageId = 724;
    sendPhotoMock.mockResolvedValueOnce({ message_id: previewMessageId });
    sendMessageMock.mockResolvedValueOnce({ message_id: groupMessageId });
    sendMessageMock.mockResolvedValueOnce({ message_id: commentMessageId });
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

    const controller = createController();
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
    expect(sendMessageMock).toHaveBeenCalledTimes(3);
    expect(sendPhotoMock).toHaveBeenCalledTimes(1);
    const commentCall = sendMessageMock.mock.calls.find(
      (call) =>
        typeof call?.[1] === 'string' && call[1].includes('💬 *Комментарий*'),
    );
    expect(commentCall?.[2]?.reply_parameters?.message_id).toBe(groupMessageId);
    const updateCall =
      updateTaskMock.mock.calls[updateTaskMock.mock.calls.length - 1];
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
      expect(updatePayload.$set?.telegram_comment_message_id).toBe(
        commentMessageId,
      );
    }
  });

  it('отправляет личное сообщение исполнителю, даже если он передан объектом', async () => {
    const groupMessageId = 401;
    const dmMessageId = 777;
    const commentMessageId = 778;
    sendMessageMock.mockResolvedValueOnce({ message_id: groupMessageId });
    sendMessageMock.mockResolvedValueOnce({ message_id: commentMessageId });
    sendMessageMock.mockResolvedValueOnce({ message_id: dmMessageId });

    const plainTask = {
      _id: '507f1f77bcf86cd799439012',
      title: 'DM check',
      attachments: [],
      assignees: [{ telegram_id: 77 }],
      created_by: 11,
      history: [],
      status: 'Новая',
      toObject() {
        return this;
      },
    } as unknown as TaskDocument & { toObject(): unknown };

    const controller = createController();
    await (
      controller as unknown as {
        notifyTaskCreated(task: TaskDocument, userId: number): Promise<void>;
      }
    ).notifyTaskCreated(plainTask as TaskDocument, 11);

    const dmCall = sendMessageMock.mock.calls.find((call) => call?.[0] === 77);
    expect(dmCall).toBeDefined();
    const dmOptions = dmCall?.[2] as { parse_mode?: string } | undefined;
    expect(dmOptions?.parse_mode).toBe('HTML');
    const commentCall = sendMessageMock.mock.calls.find(
      (call) =>
        typeof call?.[1] === 'string' && call[1].includes('💬 *Комментарий*'),
    );
    expect(commentCall?.[2]?.reply_parameters?.message_id).toBe(groupMessageId);
  });

  it('публикует фото в отдельной теме и сохраняет ссылку на альбом', async () => {
    resolvePhotosTargetMock.mockImplementation(async () => ({
      chatId: '-100100',
      topicId: 7777,
    }));

    const groupMessageId = 555;
    const albumIntroId = 556;
    const dmMessageId = 900;
    const commentMessageId = 901;

    sendMessageMock.mockResolvedValueOnce({ message_id: groupMessageId });
    sendMessageMock.mockResolvedValueOnce({ message_id: albumIntroId });
    sendMessageMock.mockResolvedValueOnce({ message_id: commentMessageId });
    sendMessageMock.mockResolvedValueOnce({ message_id: dmMessageId });
    sendPhotoMock.mockResolvedValueOnce({ message_id: 808 });

    const attachments = [
      {
        url: 'https://cdn.example.com/photo.jpg',
        type: 'image/jpeg',
        name: 'photo.jpg',
      },
      {
        url: 'https://cdn.example.com/photo-2.jpg',
        type: 'image/jpeg',
        name: 'photo-2.jpg',
      },
    ];

    const plainTask = {
      _id: '507f1f77bcf86cd799439013',
      task_number: 'B-77',
      title: 'Альбом',
      attachments,
      telegram_topic_id: 111,
      assignees: [42],
      assigned_user_id: 42,
      created_by: 10,
      history: [],
      status: 'Новая',
      toObject() {
        return this;
      },
    } as unknown as TaskDocument & { toObject(): unknown };

    const controller = createController();
    await (
      controller as unknown as {
        notifyTaskCreated(task: TaskDocument, userId: number): Promise<void>;
      }
    ).notifyTaskCreated(plainTask as TaskDocument, 99);
    const albumCall = sendMessageMock.mock.calls.find(
      (call, index) => index > 0 && call?.[2]?.message_thread_id === 7777,
    );
    expect(albumCall?.[2]?.message_thread_id).toBe(7777);
    expect(albumCall?.[1]).toBe('*Альбом*');
    const albumKeyboard = albumCall?.[2]?.reply_markup?.inline_keyboard;
    expect(albumKeyboard).toEqual([
      [{ text: 'Перейти к задаче', url: 'https://t.me/c/100/200' }],
    ]);
    expect(buildChatMessageLinkMock).toHaveBeenCalledWith(
      expect.stringMatching(/^-100/),
      groupMessageId,
      111,
    );

    const photoCall = sendPhotoMock.mock.calls[0];
    expect(photoCall?.[2]?.message_thread_id).toBe(7777);
    expect(photoCall?.[2]?.reply_parameters?.message_id).toBe(albumIntroId);

    const updateCall =
      updateTaskMock.mock.calls[updateTaskMock.mock.calls.length - 1];
    expect(updateCall).toBeDefined();
    if (updateCall) {
      const updatePayload = (updateCall[1] ?? {}) as {
        $set?: Record<string, unknown>;
      };
      expect(updatePayload.$set?.telegram_photos_chat_id).toBe('-100100');
      expect(updatePayload.$set?.telegram_photos_topic_id).toBe(7777);
      expect(updatePayload.$set?.telegram_photos_message_id).toBe(albumIntroId);
      expect(updatePayload.$set?.telegram_comment_message_id).toBe(
        commentMessageId,
      );
    }

    const markupCall = editMessageReplyMarkupMock.mock.calls.find(
      (call) => call?.[1] === groupMessageId,
    );
    expect(markupCall?.[3]?.inline_keyboard?.[0]?.[0]).toEqual({
      text: 'Фотоальбом',
      url: 'https://t.me/c/100/200',
    });
  });

  it('не отправляет личное уведомление ботам из справочника пользователей', async () => {
    const previousChatId = process.env.CHAT_ID;
    process.env.CHAT_ID = '';
    getUsersMapMock.mockResolvedValueOnce({
      '55': { name: 'ERM BOT', username: 'erm_bot', is_bot: true },
    });

    const plainTask = {
      _id: '507f1f77bcf86cd799439011',
      task_number: 'A-12',
      title: 'Тестовая задача',
      assignees: [55],
      assigned_user_id: 55,
      created_by: 55,
      history: [],
      status: 'Новая',
      toObject() {
        return this;
      },
    } as unknown as TaskDocument & { toObject(): unknown };

    const controller = createController();
    try {
      await (
        controller as unknown as {
          notifyTaskCreated(task: TaskDocument, userId: number): Promise<void>;
        }
      ).notifyTaskCreated(plainTask as TaskDocument, 99);
    } finally {
      process.env.CHAT_ID = previousChatId;
    }

    const dmCall = sendMessageMock.mock.calls.find((call) => call?.[0] === 55);
    expect(dmCall).toBeUndefined();
    expect(userUpdateOneMock).not.toHaveBeenCalled();
  });

  it('помечает пользователя как бота при ошибке Telegram 403', async () => {
    const previousChatId = process.env.CHAT_ID;
    process.env.CHAT_ID = '';
    getUsersMapMock.mockResolvedValueOnce({
      '55': { name: 'Иван', username: 'ivan', is_bot: false },
    });
    const telegramError = Object.assign(new Error('Forbidden'), {
      response: {
        error_code: 403,
        description: "Forbidden: bots can't send messages to bots",
      },
    });
    sendMessageMock.mockRejectedValueOnce(telegramError);

    const plainTask = {
      _id: '507f1f77bcf86cd799439011',
      task_number: 'A-12',
      title: 'Тестовая задача',
      assignees: [55],
      assigned_user_id: 55,
      created_by: 55,
      history: [],
      status: 'Новая',
      toObject() {
        return this;
      },
    } as unknown as TaskDocument & { toObject(): unknown };

    const controller = createController();
    try {
      await (
        controller as unknown as {
          notifyTaskCreated(task: TaskDocument, userId: number): Promise<void>;
        }
      ).notifyTaskCreated(plainTask as TaskDocument, 99);
    } finally {
      process.env.CHAT_ID = previousChatId;
    }

    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(userUpdateOneMock).toHaveBeenCalledWith(
      { telegram_id: { $eq: 55 } },
      { $set: { is_bot: true } },
    );
  });
});
