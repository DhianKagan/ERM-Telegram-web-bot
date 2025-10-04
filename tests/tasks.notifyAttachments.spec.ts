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
import sharp from 'sharp';

const escapeMd = (value: string) =>
  value.replace(/[\\_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');

jest.mock('../apps/api/src/bot/bot', () => {
  const sendMessageMock = jest.fn();
  const sendPhotoMock = jest.fn();
  const sendMediaGroupMock = jest.fn();
  const sendDocumentMock = jest.fn();
  const editMessageTextMock = jest.fn();
  const editMessageMediaMock = jest.fn();
  const deleteMessageMock = jest.fn();
  return {
    bot: {
      telegram: {
        sendMessage: sendMessageMock,
        sendPhoto: sendPhotoMock,
        sendMediaGroup: sendMediaGroupMock,
        sendDocument: sendDocumentMock,
        editMessageText: editMessageTextMock,
        editMessageMedia: editMessageMediaMock,
        deleteMessage: deleteMessageMock,
      },
    },
    __sendMessageMock: sendMessageMock,
    __sendPhotoMock: sendPhotoMock,
    __sendMediaGroupMock: sendMediaGroupMock,
    __sendDocumentMock: sendDocumentMock,
    __editMessageTextMock: editMessageTextMock,
    __editMessageMediaMock: editMessageMediaMock,
    __deleteMessageMock: deleteMessageMock,
  };
});

const {
  __sendMessageMock: sendMessageMock,
  __sendPhotoMock: sendPhotoMock,
  __sendMediaGroupMock: sendMediaGroupMock,
  __sendDocumentMock: sendDocumentMock,
  __editMessageTextMock: editMessageTextMock,
  __editMessageMediaMock: editMessageMediaMock,
  __deleteMessageMock: deleteMessageMock,
} = jest.requireMock('../apps/api/src/bot/bot') as {
  __sendMessageMock: jest.Mock;
  __sendPhotoMock: jest.Mock;
  __sendMediaGroupMock: jest.Mock;
  __sendDocumentMock: jest.Mock;
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
  const updateOneMock = jest.fn(() => ({
    exec: jest.fn().mockResolvedValue({ matchedCount: 1 }),
  }));
  return {
    Task: {
      findByIdAndUpdate: updateTaskMock,
      findById: findByIdMock,
      updateOne: updateOneMock,
    },
    File: {
      findById: fileFindByIdMock,
    },
    __updateTaskMock: updateTaskMock,
    __taskFindByIdMock: findByIdMock,
    __fileFindByIdMock: fileFindByIdMock,
    __updateOneMock: updateOneMock,
  };
});

const {
  __updateTaskMock: updateTaskMock,
  __taskFindByIdMock: taskFindByIdMock,
  __fileFindByIdMock: fileFindByIdMock,
  __updateOneMock: updateOneMock,
} = jest.requireMock(
  '../apps/api/src/db/model',
) as {
  __updateTaskMock: jest.Mock;
  __taskFindByIdMock: jest.Mock;
  __fileFindByIdMock: jest.Mock;
  __updateOneMock: jest.Mock;
};

describe('notifyTaskCreated вложения', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateOneMock.mockClear();
    fileFindByIdMock.mockReset();
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
      events.push('unknown-message');
      return Promise.resolve({ message_id: 999 });
    });
    const photoQueue = [101, 601];
    sendPhotoMock.mockImplementation((_chat, _media, options) => {
      if (options?.reply_parameters?.message_id) {
        events.push('photo');
      } else {
        events.push('main-photo');
      }
      const nextId = photoQueue.shift() ?? 499;
      return Promise.resolve({ message_id: nextId });
    });
    sendMediaGroupMock.mockImplementation(() => {
      events.push('group');
      return Promise.resolve([
        { message_id: 401 },
        { message_id: 402 },
      ]);
    });

    const appBaseUrl = (process.env.APP_URL || 'https://example.com').replace(
      /\/+$/,
      '',
    );

    const attachments = [
      { url: '/api/v1/files/a.jpg', type: 'image/jpeg', name: 'a.jpg' },
      { url: '/files/b.png', type: 'image/png', name: 'b.png' },
      { url: '/files/d.png', type: 'image/png', name: 'd.png' },
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

    expect(events).toEqual(['main-photo', 'group', 'youtube', 'photo', 'status']);
    expect(sendMediaGroupMock).toHaveBeenCalledTimes(1);
    expect(sendDocumentMock).not.toHaveBeenCalled();

    const [, youtubeText, youtubeOptions] = sendMessageMock.mock.calls[0];
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
    const [mainChat, mainMedia, mainOptions] = photoCalls[0];
    expect(typeof mainChat === 'number' || typeof mainChat === 'string').toBe(true);
    expect(mainMedia).toBe(`${appBaseUrl}/api/v1/files/a.jpg`);
    expect(mainOptions).toMatchObject({
      caption: expect.any(String),
      parse_mode: 'MarkdownV2',
    });
    expect(mainOptions).not.toHaveProperty('reply_parameters');

    const [, secondMedia, secondOptions] = photoCalls[1];
    expect(secondMedia).toBe(`${appBaseUrl}/api/v1/files/c.gif`);
    expect(secondOptions).toMatchObject({
      reply_parameters: {
        message_id: 101,
        allow_sending_without_reply: true,
      },
    });

    const mediaGroupCall = sendMediaGroupMock.mock.calls[0];
    expect(mediaGroupCall).toBeDefined();
    const [groupChat, mediaGroup, groupOptions] = mediaGroupCall;
    expect(groupChat).toBe(mainChat);
    expect(Array.isArray(mediaGroup)).toBe(true);
    expect(mediaGroup).toHaveLength(2);
    expect(mediaGroup?.[0]).toMatchObject({
      type: 'photo',
      media: `${appBaseUrl}/files/b.png`,
    });
    expect(mediaGroup?.[1]).toMatchObject({
      type: 'photo',
      media: `${appBaseUrl}/files/d.png`,
    });
    expect(groupOptions).toMatchObject({
      reply_parameters: {
        message_id: 101,
        allow_sending_without_reply: true,
      },
    });

    expect(updateTaskMock).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
      telegram_message_id: 101,
      telegram_history_message_id: 303,
      telegram_attachments_message_ids: [401, 402, 202, 601],
    });
  });

  it('переходит на sendDocument для неподдерживаемых типов изображений', async () => {
    const events: string[] = [];
    sendMessageMock.mockImplementation((_chat, text: string) => {
      if (text.startsWith('Задача')) {
        events.push('status');
        return Promise.resolve({ message_id: 303 });
      }
      events.push('unknown-message');
      return Promise.resolve({ message_id: 999 });
    });
    const photoQueue = [101, 401, 499];
    sendPhotoMock.mockImplementation((_chat, _media, options) => {
      if (options?.reply_parameters?.message_id) {
        events.push('photo');
      } else {
        events.push('main-photo');
      }
      const nextId = photoQueue.shift() ?? 450;
      return Promise.resolve({ message_id: nextId });
    });
    const documentQueue = [601, 602];
    sendDocumentMock.mockImplementation(() => {
      events.push('document');
      const nextId = documentQueue.shift() ?? 699;
      return Promise.resolve({ message_id: nextId });
    });

    const appBaseUrl = (process.env.APP_URL || 'https://example.com').replace(
      /\/+$/,
      '',
    );

    const attachments = [
      {
        url: '/api/v1/files/68dccf5809cd3805f91e2fab',
        type: 'image/jpeg',
        name: 'preview.jpg',
      },
      { url: '/api/v1/files/raw.heic', type: 'image/heic', name: 'raw.heic' },
      {
        url: 'https://cdn.example.com/vector.svg',
        type: 'image/svg+xml',
        name: 'vector.svg',
      },
      { url: '/files/result.png', type: 'image/png', name: 'result.png' },
    ];

    const plainTask = {
      _id: '507f1f77bcf86cd799439012',
      task_number: 'B-34',
      title: 'Fallback изображений',
      attachments,
      telegram_topic_id: 888,
      assignees: [55],
      assigned_user_id: 55,
      created_by: 55,
      request_id: 'REQ-2',
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

    expect(events).toEqual([
      'main-photo',
      'document',
      'document',
      'photo',
      'status',
    ]);
    expect(sendMediaGroupMock).not.toHaveBeenCalled();
    expect(sendDocumentMock).toHaveBeenCalledTimes(2);

    const documentCalls = sendDocumentMock.mock.calls;
    expect(documentCalls[0][1]).toBe(`${appBaseUrl}/api/v1/files/raw.heic`);
    expect(documentCalls[1][1]).toBe('https://cdn.example.com/vector.svg');
    documentCalls.forEach(([, , options]) => {
      expect(options).toMatchObject({
        reply_parameters: {
          message_id: 101,
          allow_sending_without_reply: true,
        },
      });
    });

    const photoCalls = sendPhotoMock.mock.calls;
    expect(photoCalls).toHaveLength(2);
    const [mainMediaCall, attachmentCall] = photoCalls;
    expect(mainMediaCall[1]).toBe(`${appBaseUrl}/api/v1/files/68dccf5809cd3805f91e2fab`);
    expect(mainMediaCall[2]).not.toHaveProperty('reply_parameters');
    expect(attachmentCall[1]).toBe(`${appBaseUrl}/files/result.png`);
    expect(attachmentCall[2]).toMatchObject({
      reply_parameters: {
        message_id: 101,
        allow_sending_without_reply: true,
      },
    });

    expect(updateTaskMock).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439012',
      expect.objectContaining({
        telegram_message_id: 101,
        telegram_history_message_id: 303,
        telegram_attachments_message_ids: [601, 602, 401],
      }),
    );
  });

  it('отправляет изображение документом при ошибке PHOTO_INVALID_DIMENSIONS', async () => {
    const error = new Error('Bad Request: PHOTO_INVALID_DIMENSIONS');
    (error as Error & { response?: { description?: string } }).response = {
      description: 'Bad Request: PHOTO_INVALID_DIMENSIONS',
    };
    sendPhotoMock.mockImplementationOnce(async () => {
      throw error;
    });
    sendDocumentMock.mockResolvedValue({ message_id: 704 });

    const controller = new TasksController({} as any);

    const result = await (controller as any).sendTaskAttachments(
      123,
      [{ kind: 'image', url: 'https://cdn.example.com/problem.jpg' }],
    );

    expect(sendPhotoMock).toHaveBeenCalledTimes(1);
    expect(sendDocumentMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual([704]);
  });

  it('отправляет крупный PNG как документ', async () => {
    sendMessageMock.mockImplementation((_chat, text: string) => {
      if (text.startsWith('Задача')) {
        return Promise.resolve({ message_id: 202 });
      }
      return Promise.resolve({ message_id: 101 });
    });

    sendDocumentMock.mockResolvedValue({ message_id: 303 });

    const attachments = [
      {
        url: 'https://cdn.example.com/large.png',
        type: 'image/png',
        name: 'large.png',
        size: 12 * 1024 * 1024,
      },
    ];

    const plainTask = {
      _id: '507f1f77bcf86cd799439099',
      task_number: 'C-56',
      title: 'Отправка крупных вложений',
      attachments,
      telegram_topic_id: 777,
      assignees: [55],
      assigned_user_id: 55,
      created_by: 55,
      request_id: 'REQ-3',
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

    expect(sendPhotoMock).not.toHaveBeenCalled();
    expect(sendMediaGroupMock).not.toHaveBeenCalled();
    expect(sendDocumentMock).toHaveBeenCalledTimes(1);
    const [chat, media, options] = sendDocumentMock.mock.calls[0];
    expect(typeof chat === 'number' || typeof chat === 'string').toBe(true);
    expect(media).toBe('https://cdn.example.com/large.png');
    expect(options).toMatchObject({
      reply_parameters: {
        message_id: 101,
        allow_sending_without_reply: true,
      },
    });

    expect(updateTaskMock).toHaveBeenCalledWith('507f1f77bcf86cd799439099', {
      telegram_message_id: 101,
      telegram_history_message_id: 202,
      telegram_attachments_message_ids: [303],
    });
  });

  it('добавляет inline-изображения из описания к вложениям', async () => {
    sendMessageMock.mockImplementation((_chat, text: string) => {
      if (text.startsWith('Задача')) {
        return Promise.resolve({ message_id: 404 });
      }
      return Promise.resolve({ message_id: 303 });
    });
    sendMediaGroupMock.mockResolvedValue([
      { message_id: 202 },
      { message_id: 303 },
    ]);
    sendPhotoMock
      .mockImplementationOnce(() => Promise.resolve({ message_id: 101 }))
      .mockImplementationOnce(() => Promise.resolve({ message_id: 505 }));

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
    expect(sendPhotoMock).toHaveBeenCalledTimes(2);
    const [mainCall, extraCall] = sendPhotoMock.mock.calls;
    expect(mainCall[1]).toBe(`${appBaseUrl}/api/v1/files/inline.png?mode=inline`);
    expect(mainCall[2]).not.toHaveProperty('reply_parameters');
    expect(extraCall[1]).toBe('https://cdn.example.com/pic.jpg?mode=inline');
    expect(extraCall[2]).toMatchObject({
      reply_parameters: {
        allow_sending_without_reply: true,
        message_id: 101,
      },
    });
    expect(extraCall[2]).not.toHaveProperty('caption');

    expect(updateTaskMock).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
      telegram_message_id: 101,
      telegram_history_message_id: 404,
      telegram_attachments_message_ids: [505],
    });
  });

  it('создаёт временный коллаж из нескольких локальных изображений для превью', async () => {
    const uploadsRoot = path.resolve(uploadsDir);
    const tempDir = path.join(uploadsRoot, 'tests-collage-preview');
    await fs.mkdir(tempDir, { recursive: true });

    const fileIds = [
      '68dccf5809cd3805f91e2fa1',
      '68dccf5809cd3805f91e2fa2',
    ];

    const createImage = async (filename: string, color: string) => {
      const absolutePath = path.join(tempDir, filename);
      await sharp({
        create: {
          width: 640,
          height: 480,
          channels: 3,
          background: color,
        },
      })
        .jpeg({ quality: 90 })
        .toFile(absolutePath);
      const relative = path.relative(uploadsRoot, absolutePath);
      const stats = await fs.stat(absolutePath);
      return { absolutePath, relative, size: stats.size };
    };

    const [firstImage, secondImage] = await Promise.all([
      createImage('first.jpg', '#ff0000'),
      createImage('second.jpg', '#0000ff'),
    ]);

    const docById = new Map<string, { path: string; name: string; type: string; size: number }>([
      [
        fileIds[0],
        {
          path: firstImage.relative.split(path.sep).join('/'),
          name: 'first.jpg',
          type: 'image/jpeg',
          size: firstImage.size,
        },
      ],
      [
        fileIds[1],
        {
          path: secondImage.relative.split(path.sep).join('/'),
          name: 'second.jpg',
          type: 'image/jpeg',
          size: secondImage.size,
        },
      ],
    ]);

    fileFindByIdMock.mockImplementation((id: string) => ({
      lean: () => Promise.resolve(docById.get(id) ?? null),
    }));

    sendMessageMock.mockImplementation((_chat, text: string) => {
      if (text.startsWith('Задача')) {
        return Promise.resolve({ message_id: 404 });
      }
      return Promise.resolve({ message_id: 303 });
    });

    let mainPreview: unknown = null;
    sendPhotoMock.mockImplementation((_chat, media, options) => {
      if (!options?.reply_parameters) {
        mainPreview = media;
        return Promise.resolve({ message_id: 101 });
      }
      return Promise.resolve({ message_id: 501 });
    });
    sendMediaGroupMock.mockResolvedValue([
      { message_id: 601 },
      { message_id: 602 },
    ]);

    const plainTask = {
      _id: '507f1f77bcf86cd799439099',
      task_number: 'C-77',
      title: 'Задача с изображениями',
      telegram_topic_id: 777,
      assignees: [55],
      assigned_user_id: 55,
      created_by: 55,
      request_id: 'REQ-77',
      createdAt: '2024-02-01T00:00:00Z',
      attachments: [
        { url: `/api/v1/files/${fileIds[0]}`, type: 'image/jpeg', name: 'first.jpg' },
        { url: `/api/v1/files/${fileIds[1]}`, type: 'image/jpeg', name: 'second.jpg' },
      ],
      task_description: '<p>Проверяем коллаж</p>',
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

    expect(mainPreview).not.toBeNull();
    expect(typeof mainPreview).toBe('object');
    const descriptor = mainPreview as { filename?: string; contentType?: string };
    expect(descriptor.filename).toMatch(/^collage_.*\.jpg$/);
    expect(descriptor.contentType).toBe('image/jpeg');
    expect(Object.prototype.hasOwnProperty.call(descriptor, 'source')).toBe(true);
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
      return Promise.resolve({ message_id: 303 });
    });
    sendMediaGroupMock.mockResolvedValue([]);
    sendPhotoMock
      .mockImplementationOnce(() => Promise.resolve({ message_id: 101 }))
      .mockImplementationOnce(() => Promise.resolve({ message_id: 202 }));

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

    expect(sendPhotoMock).toHaveBeenCalledTimes(2);
    const [mainCall, extraCall] = sendPhotoMock.mock.calls;
    expect(mainCall[1]).toBe('https://cdn.example.com/external.jpg?mode=inline');
    expect(mainCall[2]).not.toHaveProperty('reply_parameters');
    expect(extraCall[1]).toEqual(
      expect.objectContaining({
        filename: 'inline.jpg',
        contentType: 'image/jpeg',
      }),
    );
    expect(extraCall[1]).toHaveProperty('source');
    expect(extraCall[2]).toMatchObject({
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
      return Promise.resolve({ message_id: 303 });
    });
    sendPhotoMock.mockResolvedValue({ message_id: 101 });

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
    expect(options).not.toHaveProperty('reply_parameters');
    expect(updateTaskMock).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      expect.objectContaining({
        telegram_message_id: 101,
        telegram_history_message_id: 404,
      }),
    );
    expect(
      updateTaskMock.mock.calls[0][1],
    ).not.toHaveProperty('telegram_attachments_message_ids');
  });
});

describe('syncTelegramTaskMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateOneMock.mockClear();
  });

  it('удаляет старое сообщение перед сохранением нового идентификатора', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const previous = {
      telegram_message_id: 111,
      telegram_topic_id: 777,
    } as Record<string, unknown>;
    const freshPlain = {
      _id: '507f1f77bcf86cd799439012',
      telegram_message_id: 111,
      telegram_topic_id: 777,
      assigned_user_id: 55,
      assignees: [55],
      created_by: 55,
      attachments: [],
      title: 'Проверка',
      task_number: 'A-42',
      status: 'new',
      history: [],
    };
    taskFindByIdMock.mockResolvedValueOnce({
      toObject() {
        return { ...freshPlain } as unknown as TaskDocument;
      },
    });
    editMessageTextMock.mockRejectedValueOnce(new Error('cannot edit'));
    sendMessageMock.mockResolvedValueOnce({ message_id: 222 });
    deleteMessageMock.mockResolvedValueOnce(undefined);

    const controller = new TasksController({} as any);

    try {
      await (controller as any).syncTelegramTaskMessage(freshPlain._id, {
        ...previous,
      });

      expect(deleteMessageMock).toHaveBeenCalledWith(process.env.CHAT_ID, 111);
      expect(updateOneMock).toHaveBeenCalledTimes(1);
      const [filter, update] = updateOneMock.mock.calls[0];
      expect(filter).toMatchObject({
        _id: freshPlain._id,
        telegram_message_id: 111,
      });
      expect(update).toMatchObject({
        $set: { telegram_message_id: 222 },
      });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('не перезаписывает идентификатор при ошибке удаления старого сообщения', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const previous = {
      telegram_message_id: 333,
      telegram_topic_id: 888,
    } as Record<string, unknown>;
    const freshPlain = {
      _id: '507f1f77bcf86cd799439013',
      telegram_message_id: 333,
      telegram_topic_id: 888,
      assigned_user_id: 55,
      assignees: [55],
      created_by: 55,
      attachments: [],
      title: 'Отказ удаления',
      task_number: 'B-17',
      status: 'new',
      history: [],
    };
    taskFindByIdMock.mockResolvedValueOnce({
      toObject() {
        return { ...freshPlain } as unknown as TaskDocument;
      },
    });
    editMessageTextMock.mockRejectedValueOnce(new Error('cannot edit'));
    sendMessageMock.mockResolvedValueOnce({ message_id: 444 });
    deleteMessageMock.mockRejectedValueOnce(new Error('message not found'));

    const controller = new TasksController({} as any);

    try {
      await (controller as any).syncTelegramTaskMessage(freshPlain._id, {
        ...previous,
      });

      expect(deleteMessageMock).toHaveBeenCalledWith(process.env.CHAT_ID, 333);
      expect(updateOneMock).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        'Пропускаем сохранение нового telegram_message_id из-за ошибки удаления',
        { taskId: freshPlain._id },
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('syncTelegramTaskMessage вложения', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateOneMock.mockClear();
  });

  it('обновляет изображение через editMessageMedia без пересоздания сообщений', async () => {
    editMessageTextMock.mockResolvedValue(undefined);
    editMessageMediaMock.mockResolvedValue({});
    const freshPlain = {
      _id: '507f1f77bcf86cd799439011',
      task_number: 'A-12',
      title: 'Задача',
      telegram_message_id: 1001,
      telegram_attachments_message_ids: [404],
      telegram_topic_id: 777,
      attachments: [
        {
          url: 'https://cdn.example.com/new-preview.jpg',
          type: 'image/jpeg',
          name: 'new-preview',
        },
        {
          url: 'https://cdn.example.com/new-extra.jpg',
          type: 'image/jpeg',
          name: 'new-extra',
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
      ...freshPlain,
      attachments: [
        {
          url: 'https://cdn.example.com/old-preview.jpg',
          type: 'image/jpeg',
          name: 'old-preview',
        },
        {
          url: 'https://cdn.example.com/old-extra.jpg',
          type: 'image/jpeg',
          name: 'old-extra',
        },
      ],
    };

    const controller = new TasksController({} as any);

    const previousExtras = (controller as any).collectSendableAttachments(
      previousState,
      undefined,
    );
    const nextExtras = (controller as any).collectSendableAttachments(
      freshPlain,
      undefined,
    );
    expect(previousExtras.extras).toEqual([
      { kind: 'image', url: 'https://cdn.example.com/old-extra.jpg' },
    ]);
    expect(nextExtras.extras).toEqual([
      { kind: 'image', url: 'https://cdn.example.com/new-extra.jpg' },
    ]);

    await (controller as any).syncTelegramTaskMessage(
      '507f1f77bcf86cd799439011',
      previousState,
    );

    expect(editMessageMediaMock).toHaveBeenCalledTimes(2);
    const [mainCall, attachmentCall] = editMessageMediaMock.mock.calls;
    const [mainChat, mainMessageId, , mainMedia] = mainCall;
    expect(mainChat).toBe(process.env.CHAT_ID);
    expect(mainMessageId).toBe(1001);
    expect(mainMedia).toMatchObject({
      type: 'photo',
      media: 'https://cdn.example.com/new-preview.jpg',
      caption: expect.any(String),
      parse_mode: 'MarkdownV2',
    });
    const [attachmentChat, attachmentMessageId, , attachmentMedia] = attachmentCall;
    expect(attachmentChat).toBe(process.env.CHAT_ID);
    expect(attachmentMessageId).toBe(404);
    expect(attachmentMedia).toMatchObject({
      type: 'photo',
      media: 'https://cdn.example.com/new-extra.jpg',
    });
    expect(deleteMessageMock).not.toHaveBeenCalled();
    expect(sendPhotoMock).not.toHaveBeenCalled();
    expect(updateTaskMock).not.toHaveBeenCalled();
  });

  it('переотправляет вложения при ошибке editMessageMedia', async () => {
    editMessageTextMock.mockResolvedValue(undefined);
    editMessageMediaMock.mockRejectedValue(new Error('Bad Request: INTERNAL_ERROR'));
    deleteMessageMock.mockResolvedValue(undefined);
    sendPhotoMock
      .mockImplementationOnce(() => Promise.resolve({ message_id: 1002 }))
      .mockImplementationOnce(() => Promise.resolve({ message_id: 601 }));

    const freshPlain = {
      _id: '507f1f77bcf86cd799439011',
      task_number: 'A-12',
      title: 'Задача',
      telegram_message_id: 1001,
      telegram_attachments_message_ids: [404],
      telegram_topic_id: 777,
      attachments: [
        {
          url: 'https://cdn.example.com/new-preview.jpg',
          type: 'image/jpeg',
          name: 'new-preview',
        },
        {
          url: 'https://cdn.example.com/new-extra.jpg',
          type: 'image/jpeg',
          name: 'new-extra',
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
      ...freshPlain,
      attachments: [
        {
          url: 'https://cdn.example.com/old-preview.jpg',
          type: 'image/jpeg',
          name: 'old-preview',
        },
        {
          url: 'https://cdn.example.com/old-extra.jpg',
          type: 'image/jpeg',
          name: 'old-extra',
        },
      ],
    };

    const controller = new TasksController({} as any);

    const previousExtras = (controller as any).collectSendableAttachments(
      previousState,
      undefined,
    );
    const nextExtras = (controller as any).collectSendableAttachments(
      freshPlain,
      undefined,
    );
    expect(previousExtras.extras).toEqual([
      { kind: 'image', url: 'https://cdn.example.com/old-extra.jpg' },
    ]);
    expect(nextExtras.extras).toEqual([
      { kind: 'image', url: 'https://cdn.example.com/new-extra.jpg' },
    ]);

    await (controller as any).syncTelegramTaskMessage(
      '507f1f77bcf86cd799439011',
      previousState,
    );

    expect(editMessageMediaMock).toHaveBeenCalledTimes(1);
    expect(deleteMessageMock).toHaveBeenNthCalledWith(
      1,
      process.env.CHAT_ID,
      1001,
    );
    expect(deleteMessageMock).toHaveBeenNthCalledWith(
      2,
      process.env.CHAT_ID,
      404,
    );
    expect(deleteMessageMock).toHaveBeenCalledTimes(2);
    expect(sendPhotoMock).toHaveBeenCalledTimes(2);
    const [mainCall, attachmentCall] = sendPhotoMock.mock.calls;
    expect(mainCall[2]).not.toHaveProperty('reply_parameters');
    expect(attachmentCall[2]).toMatchObject({
      reply_parameters: {
        message_id: 1002,
        allow_sending_without_reply: true,
      },
    });
    expect(updateOneMock).toHaveBeenCalledTimes(1);
    const [updateFilter, updatePayload] = updateOneMock.mock.calls[0];
    expect(updateFilter).toMatchObject({
      _id: '507f1f77bcf86cd799439011',
      telegram_message_id: 1001,
    });
    expect(updatePayload).toMatchObject({
      $set: {
        telegram_message_id: 1002,
        telegram_attachments_message_ids: [601],
      },
    });
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
    expect(editMessageMediaMock).toHaveBeenCalledTimes(1);
    const [mainChat, mainMessageId, , mainMedia, mainExtra] =
      editMessageMediaMock.mock.calls[0];
    expect(mainChat).toBe(process.env.CHAT_ID);
    expect(mainMessageId).toBe(1001);
    expect(mainMedia).toMatchObject({ type: 'photo', media: 'https://cdn.example.com/new.jpg' });
    expect(mainExtra).toMatchObject({ inline_keyboard: [] });
    expect(deleteMessageMock).toHaveBeenCalledTimes(1);
    expect(deleteMessageMock.mock.calls[0][1]).toBe(404);
    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(sendPhotoMock).not.toHaveBeenCalled();
    expect(sendMediaGroupMock).not.toHaveBeenCalled();
    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: '507f1f77bcf86cd799439011' },
      expect.objectContaining({
        $set: { telegram_attachments_message_ids: [] },
      }),
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
    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: '507f1f77bcf86cd799439011' },
      expect.objectContaining({
        $set: { telegram_attachments_message_ids: [] },
      }),
    );
  });
});

