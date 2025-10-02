/**
 * Назначение файла: проверка отправки вложений при создании задачи.
 * Основные модули: TasksController, Telegram-бот (моки).
 */
import 'reflect-metadata';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { TaskDocument } from '../apps/api/src/db/model';
import TasksController from '../apps/api/src/tasks/tasks.controller';
import { uploadsDir } from '../apps/api/src/config/storage';

const escapeMd = (value: string) =>
  value.replace(/[\\_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');

jest.mock('../apps/api/src/bot/bot', () => {
  const sendMessageMock = jest.fn();
  const sendPhotoMock = jest.fn();
  const sendMediaGroupMock = jest.fn();
  const editMessageTextMock = jest.fn();
  const editMessageMediaMock = jest.fn();
  const deleteMessageMock = jest.fn();
  return {
    bot: {
      telegram: {
        sendMessage: sendMessageMock,
        sendPhoto: sendPhotoMock,
        sendMediaGroup: sendMediaGroupMock,
        editMessageText: editMessageTextMock,
        editMessageMedia: editMessageMediaMock,
        deleteMessage: deleteMessageMock,
      },
    },
    __sendMessageMock: sendMessageMock,
    __sendPhotoMock: sendPhotoMock,
    __sendMediaGroupMock: sendMediaGroupMock,
    __editMessageTextMock: editMessageTextMock,
    __editMessageMediaMock: editMessageMediaMock,
    __deleteMessageMock: deleteMessageMock,
  };
});

const {
  __sendMessageMock: sendMessageMock,
  __sendPhotoMock: sendPhotoMock,
  __sendMediaGroupMock: sendMediaGroupMock,
  __editMessageTextMock: editMessageTextMock,
  __editMessageMediaMock: editMessageMediaMock,
  __deleteMessageMock: deleteMessageMock,
} = jest.requireMock('../apps/api/src/bot/bot') as {
  __sendMessageMock: jest.Mock;
  __sendPhotoMock: jest.Mock;
  __sendMediaGroupMock: jest.Mock;
  __editMessageTextMock: jest.Mock;
  __editMessageMediaMock: jest.Mock;
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

jest.mock('../apps/api/src/db/model', () => {
  const updateTaskMock = jest.fn(() => ({
    exec: jest.fn().mockResolvedValue(undefined),
  }));
  const findByIdMock = jest.fn();
  const fileFindByIdMock = jest.fn();
  return {
    Task: {
      findByIdAndUpdate: updateTaskMock,
      findById: findByIdMock,
    },
    File: {
      findById: fileFindByIdMock,
    },
    __updateTaskMock: updateTaskMock,
    __taskFindByIdMock: findByIdMock,
    __fileFindByIdMock: fileFindByIdMock,
  };
});

const {
  __updateTaskMock: updateTaskMock,
  __taskFindByIdMock: taskFindByIdMock,
  __fileFindByIdMock: fileFindByIdMock,
} = jest.requireMock(
  '../apps/api/src/db/model',
) as {
  __updateTaskMock: jest.Mock;
  __taskFindByIdMock: jest.Mock;
  __fileFindByIdMock: jest.Mock;
};

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
    const photoQueue = [401, 402];
    sendPhotoMock.mockImplementation(() => {
      events.push('photo');
      const nextId = photoQueue.shift() ?? 499;
      return Promise.resolve({ message_id: nextId });
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

    expect(events).toEqual(['main', 'photo', 'youtube', 'photo', 'status']);
    expect(sendMediaGroupMock).not.toHaveBeenCalled();

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

    const photoCalls = sendPhotoMock.mock.calls;
    expect(photoCalls).toHaveLength(2);
    expect(photoCalls[0][1]).toBe(`${appBaseUrl}/files/b.png`);
    expect(photoCalls[1][1]).toBe(`${appBaseUrl}/api/v1/files/c.gif`);
    photoCalls.forEach(([, , options]) => {
      expect(options).toMatchObject({
        reply_parameters: {
          message_id: 101,
          allow_sending_without_reply: true,
        },
      });
    });

    expect(updateTaskMock).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
      telegram_message_id: 101,
      telegram_status_message_id: 303,
      telegram_attachments_message_ids: [401, 202, 402],
    });
  });

  it('добавляет inline-изображения из описания к вложениям', async () => {
    sendMessageMock.mockImplementation((_chat, text: string) => {
      if (text.startsWith('Задача')) {
        return Promise.resolve({ message_id: 404 });
      }
      return Promise.resolve({ message_id: 101 });
    });
    sendMediaGroupMock.mockResolvedValue([
      { message_id: 202 },
      { message_id: 303 },
    ]);
    sendPhotoMock.mockResolvedValue({ message_id: 404 });

    const appBaseUrl = (process.env.APP_URL || 'https://example.com').replace(
      /\/+$/,
      '',
    );

    const plainTask = {
      _id: '507f1f77bcf86cd799439011',
      task_number: 'A-12',
      title: 'Тестовая задача',
      telegram_topic_id: 321,
      assignees: [55],
      assigned_user_id: 55,
      created_by: 55,
      request_id: 'REQ-1',
      createdAt: '2024-01-01T00:00:00Z',
      attachments: [],
      task_description:
        '<p>Описание.</p><img src="/api/v1/files/inline.png" alt="Чертёж" />' +
        '<p>Примечание.</p><img src="https://cdn.example.com/pic.jpg" />',
    };

    const task = {
      ...plainTask,
      toObject() {
        return { ...plainTask } as unknown as TaskDocument;
      },
    } as unknown as TaskDocument;

    const controller = new TasksController({} as any);

    await (controller as any).notifyTaskCreated(task, 55);

    expect(sendMediaGroupMock).not.toHaveBeenCalled();
    expect(sendPhotoMock).toHaveBeenCalledTimes(1);
    const [, photoMedia, photoOptions] = sendPhotoMock.mock.calls[0];
    expect(photoMedia).toBe('https://cdn.example.com/pic.jpg?mode=inline');
    expect(photoOptions).toMatchObject({
      reply_parameters: {
        allow_sending_without_reply: true,
        message_id: 101,
      },
    });
    expect(photoOptions).not.toHaveProperty('caption');

    expect(updateTaskMock).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
      telegram_message_id: 101,
      telegram_status_message_id: 404,
      telegram_attachments_message_ids: [404],
    });
  });

  it('использует локальный файл для одиночного inline-изображения', async () => {
    const uploadsRoot = path.resolve(uploadsDir);
    const tempDir = path.join(uploadsRoot, 'tests-inline');
    const absolutePath = path.join(tempDir, 'inline.jpg');
    const relativePath = path.relative(uploadsRoot, absolutePath);

    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(absolutePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

    fileFindByIdMock.mockReturnValue({
      lean: () =>
        Promise.resolve({
          path: relativePath,
          name: 'inline.jpg',
          type: 'image/jpeg',
        }),
    });

    sendMessageMock.mockImplementation((_chat, text: string) => {
      if (text.startsWith('Задача')) {
        return Promise.resolve({ message_id: 404 });
      }
      return Promise.resolve({ message_id: 101 });
    });
    sendMediaGroupMock.mockResolvedValue([]);
    sendPhotoMock.mockResolvedValue({ message_id: 202 });

    const plainTask = {
      _id: '507f1f77bcf86cd799439011',
      task_number: 'A-12',
      title: 'Тестовая задача',
      telegram_topic_id: 321,
      assignees: [55],
      assigned_user_id: 55,
      created_by: 55,
      request_id: 'REQ-1',
      createdAt: '2024-01-01T00:00:00Z',
      attachments: [],
      task_description:
        '<p>Описание.</p>' +
        '<img src="https://cdn.example.com/external.jpg" alt="Эскиз" />' +
        '<img src="/api/v1/files/68dccf5809cd3805f91e2fad" alt="Локально" />',
    };

    const task = {
      ...plainTask,
      toObject() {
        return { ...plainTask } as unknown as TaskDocument;
      },
    } as unknown as TaskDocument;

    const controller = new TasksController({} as any);

    try {
      await (controller as any).notifyTaskCreated(task, 55);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }

    expect(sendPhotoMock).toHaveBeenCalledTimes(1);
    const [, media, options] = sendPhotoMock.mock.calls[0];
    expect(media).toEqual(
      expect.objectContaining({
        filename: 'inline.jpg',
        contentType: 'image/jpeg',
      }),
    );
    expect(media).toHaveProperty('source');
    expect(options).toMatchObject({
      reply_parameters: {
        message_id: 101,
        allow_sending_without_reply: true,
      },
    });
  });

  it('отправляет фото при единственном локальном inline-изображении', async () => {
    const uploadsRoot = path.resolve(uploadsDir);
    const tempDir = path.join(uploadsRoot, 'tests-single-inline');
    const absolutePath = path.join(tempDir, 'single.jpg');
    const relativePath = path.relative(uploadsRoot, absolutePath);

    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(absolutePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

    const fileId = '68dccf5809cd3805f91e2fab';
    fileFindByIdMock.mockReturnValue({
      lean: () =>
        Promise.resolve({
          path: relativePath,
          name: 'single.jpg',
          type: 'image/jpeg',
        }),
    });

    sendMessageMock.mockImplementation((_chat, text: string) => {
      if (text.startsWith('Задача')) {
        return Promise.resolve({ message_id: 404 });
      }
      return Promise.resolve({ message_id: 101 });
    });
    sendPhotoMock.mockResolvedValue({ message_id: 202 });

    const plainTask = {
      _id: '507f1f77bcf86cd799439011',
      task_number: 'A-12',
      title: 'Тестовая задача',
      telegram_topic_id: 321,
      assignees: [55],
      assigned_user_id: 55,
      created_by: 55,
      request_id: 'REQ-1',
      createdAt: '2024-01-01T00:00:00Z',
      attachments: [],
      task_description:
        `<p>Описание.</p><img src="/api/v1/files/${fileId}" alt="Локально" />`,
    };

    const task = {
      ...plainTask,
      toObject() {
        return { ...plainTask } as unknown as TaskDocument;
      },
    } as unknown as TaskDocument;

    const controller = new TasksController({} as any);

    try {
      await (controller as any).notifyTaskCreated(task, 55);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }

    expect(sendMediaGroupMock).not.toHaveBeenCalled();
    expect(sendPhotoMock).toHaveBeenCalledTimes(1);
    const [, media, options] = sendPhotoMock.mock.calls[0];
    expect(media).toEqual(
      expect.objectContaining({
        filename: 'single.jpg',
        contentType: 'image/jpeg',
      }),
    );
    expect(media).toHaveProperty('source');
    expect(options).toMatchObject({
      reply_parameters: {
        message_id: 101,
        allow_sending_without_reply: true,
      },
    });
    expect(updateTaskMock).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
      telegram_message_id: 101,
      telegram_status_message_id: 404,
      telegram_attachments_message_ids: [202],
    });
  });
});

describe('syncTelegramTaskMessage вложения', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('обновляет существующее сообщение вложения без создания нового', async () => {
    editMessageTextMock.mockResolvedValue(undefined);
    editMessageMediaMock.mockResolvedValue(undefined);
    deleteMessageMock.mockResolvedValue(undefined);
    const freshPlain = {
      _id: '507f1f77bcf86cd799439011',
      task_number: 'A-12',
      title: 'Задача',
      telegram_message_id: 1001,
      telegram_attachments_message_ids: [404],
      telegram_topic_id: 777,
      attachments: [
        {
          url: 'https://cdn.example.com/new.jpg',
          type: 'image/jpeg',
          name: 'new',
        },
      ],
      assignees: [55],
      assigned_user_id: 55,
      created_by: 55,
      request_id: 'REQ-1',
      createdAt: '2024-01-01T00:00:00Z',
    };
    taskFindByIdMock.mockResolvedValue({
      toObject: () => ({ ...freshPlain }),
    });

    const previousState = {
      _id: '507f1f77bcf86cd799439011',
      task_number: 'A-12',
      title: 'Задача',
      telegram_message_id: 1001,
      telegram_attachments_message_ids: [404],
      telegram_topic_id: 777,
      attachments: [
        {
          url: 'https://cdn.example.com/old.jpg',
          type: 'image/jpeg',
          name: 'old',
        },
      ],
      assignees: [55],
      assigned_user_id: 55,
      created_by: 55,
      request_id: 'REQ-1',
      createdAt: '2024-01-01T00:00:00Z',
    };

    const controller = new TasksController({} as any);

    await (controller as any).syncTelegramTaskMessage(
      '507f1f77bcf86cd799439011',
      previousState,
    );

    expect(taskFindByIdMock).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(editMessageMediaMock).not.toHaveBeenCalled();
    expect(deleteMessageMock).toHaveBeenCalledTimes(1);
    expect(deleteMessageMock.mock.calls[0][1]).toBe(404);
    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(sendPhotoMock).not.toHaveBeenCalled();
    expect(sendMediaGroupMock).not.toHaveBeenCalled();
    expect(updateTaskMock).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      { telegram_attachments_message_ids: [] },
    );
  });

  it('удаляет сообщения вложений при очистке списка', async () => {
    editMessageTextMock.mockResolvedValue(undefined);
    deleteMessageMock.mockResolvedValue(undefined);
    taskFindByIdMock.mockResolvedValue({
      toObject: () => ({
        _id: '507f1f77bcf86cd799439011',
        task_number: 'A-12',
        title: 'Задача',
        telegram_message_id: 1001,
        telegram_attachments_message_ids: [501, 502],
        telegram_topic_id: 777,
        attachments: [],
        assignees: [55],
        assigned_user_id: 55,
        created_by: 55,
        request_id: 'REQ-1',
        createdAt: '2024-01-01T00:00:00Z',
      }),
    });

    const previousState = {
      _id: '507f1f77bcf86cd799439011',
      task_number: 'A-12',
      title: 'Задача',
      telegram_message_id: 1001,
      telegram_attachments_message_ids: [501, 502],
      telegram_topic_id: 777,
      attachments: [
        {
          url: 'https://cdn.example.com/old.jpg',
          type: 'image/jpeg',
        },
        {
          url: 'https://cdn.example.com/old2.jpg',
          type: 'image/jpeg',
        },
      ],
      assignees: [55],
      assigned_user_id: 55,
      created_by: 55,
      request_id: 'REQ-1',
      createdAt: '2024-01-01T00:00:00Z',
    };

    const controller = new TasksController({} as any);

    await (controller as any).syncTelegramTaskMessage(
      '507f1f77bcf86cd799439011',
      previousState,
    );

    expect(deleteMessageMock).toHaveBeenCalledTimes(2);
    const deletedIds = deleteMessageMock.mock.calls.map((call) => call[1]);
    expect(deletedIds.sort()).toEqual([501, 502]);
    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(updateTaskMock).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      expect.objectContaining({ telegram_attachments_message_ids: [] }),
    );
  });
});

