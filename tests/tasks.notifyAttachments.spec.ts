/**
 * Назначение файла: проверка отправки вложений при создании задачи.
 * Основные модули: TasksController, Telegram-бот (моки).
 */
import 'reflect-metadata';
import path from 'node:path';
import os from 'node:os';
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
  const editMessageCaptionMock = jest.fn();
  const editMessageReplyMarkupMock = jest.fn();
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
        editMessageCaption: editMessageCaptionMock,
        editMessageReplyMarkup: editMessageReplyMarkupMock,
        deleteMessage: deleteMessageMock,
      },
    },
    __sendMessageMock: sendMessageMock,
    __sendPhotoMock: sendPhotoMock,
    __sendMediaGroupMock: sendMediaGroupMock,
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
  __sendPhotoMock: sendPhotoMock,
  __sendMediaGroupMock: sendMediaGroupMock,
  __sendDocumentMock: sendDocumentMock,
  __editMessageTextMock: editMessageTextMock,
  __editMessageMediaMock: editMessageMediaMock,
  __editMessageCaptionMock: editMessageCaptionMock,
  __editMessageReplyMarkupMock: editMessageReplyMarkupMock,
  __deleteMessageMock: deleteMessageMock,
} = jest.requireMock('../apps/api/src/bot/bot') as {
  __sendMessageMock: jest.Mock;
  __sendPhotoMock: jest.Mock;
  __sendMediaGroupMock: jest.Mock;
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
    sendPhotoMock.mockResolvedValue({ message_id: 450 });
    sendMediaGroupMock
      .mockImplementationOnce(() => {
        events.push('preview-group');
        return Promise.resolve([
          { message_id: 111 },
          { message_id: 112 },
        ]);
      })
      .mockImplementationOnce(() => {
        events.push('attachments-group');
        return Promise.resolve([
          { message_id: 211 },
          { message_id: 212 },
        ]);
      });

    const appBaseUrl = (process.env.APP_URL || 'https://example.com').replace(
      /\/+$/,
      '',
    );

    const attachments = [
      {
        url: '/api/v1/files/68dccf5809cd3805f91e2fab',
        type: 'image/jpeg',
        name: 'first.jpg',
      },
      {
        url: '/api/v1/files/68dccf5809cd3805f91e2fac',
        type: 'image/png',
        name: 'second.png',
      },
      { url: '/files/d.png', type: 'image/png', name: 'remote.png' },
      {
        url: 'https://cdn.example.com/extra.gif',
        type: 'image/gif',
        name: 'extra.gif',
      },
      { url: 'https://youtu.be/demo', type: 'text/html', name: 'Видео' },
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

    expect(events).toEqual([
      'preview-group',
      'attachments-group',
      'youtube',
      'status',
    ]);
    expect(sendPhotoMock).not.toHaveBeenCalledWith(
      expect.anything(),
      `${appBaseUrl}/api/v1/files/68dccf5809cd3805f91e2fab`,
      expect.anything(),
    );
    expect(sendPhotoMock).not.toHaveBeenCalledWith(
      expect.anything(),
      `${appBaseUrl}/api/v1/files/68dccf5809cd3805f91e2fac`,
      expect.anything(),
    );

    expect(sendMediaGroupMock).toHaveBeenCalledTimes(2);
    const [previewCall, attachmentsCall] = sendMediaGroupMock.mock.calls;
    const [previewChat, previewMedia, previewOptions] = previewCall;
    expect(previewOptions).toMatchObject({ message_thread_id: 777 });
    expect(Array.isArray(previewMedia)).toBe(true);
    expect(previewMedia).toHaveLength(2);
    const previewCaption = previewMedia?.[0]?.caption;
    expect(typeof previewCaption).toBe('string');
    expect(previewMedia?.[0]).toMatchObject({
      type: 'photo',
      parse_mode: 'MarkdownV2',
    });
    expect(previewMedia?.[1]).toMatchObject({ type: 'photo' });

    const [attachmentsChat, attachmentsMedia, attachmentsOptions] = attachmentsCall;
    expect(attachmentsChat).toBe(previewChat);
    expect(attachmentsOptions).toMatchObject({
      reply_parameters: {
        message_id: 111,
        allow_sending_without_reply: true,
      },
    });
    expect(Array.isArray(attachmentsMedia)).toBe(true);
    expect(attachmentsMedia).toHaveLength(2);
    expect(attachmentsMedia?.[0]).toMatchObject({
      media: `${appBaseUrl}/files/d.png`,
      type: 'photo',
    });
    expect(attachmentsMedia?.[1]).toMatchObject({
      media: 'https://cdn.example.com/extra.gif',
      type: 'photo',
    });

    expect(editMessageCaptionMock).toHaveBeenCalledWith(
      previewChat,
      111,
      undefined,
      previewCaption,
      expect.objectContaining({
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: [] },
      }),
    );
    expect(editMessageReplyMarkupMock).toHaveBeenCalledWith(
      previewChat,
      111,
      undefined,
      { inline_keyboard: [] },
    );

    const [, youtubeText, youtubeOptions] = sendMessageMock.mock.calls[0];
    const expectedYoutubeText = `▶️ [${escapeMd('Видео')}](${escapeMd(
      'https://youtu.be/demo',
    )})`;
    expect(youtubeText).toBe(expectedYoutubeText);
    expect(youtubeOptions).toMatchObject({
      parse_mode: 'MarkdownV2',
      reply_parameters: {
        allow_sending_without_reply: true,
        message_id: 111,
      },
    });

    expect(updateTaskMock).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
      telegram_message_id: 111,
      telegram_history_message_id: 303,
      telegram_preview_message_ids: [111, 112],
      telegram_attachments_message_ids: [211, 212, 202],
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
        telegram_preview_message_ids: [101],
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
      telegram_preview_message_ids: [101],
      telegram_attachments_message_ids: [505],
    });
  });

  it('отправляет локальные изображения медиагруппой без создания коллажа', async () => {
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

    sendPhotoMock.mockImplementation(() => {
      throw new Error('sendPhoto should not be used for медиагруппа превью');
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

    expect(sendMediaGroupMock).toHaveBeenCalledTimes(1);
    const [previewCall] = sendMediaGroupMock.mock.calls;
    const [chatId, mediaGroup, options] = previewCall;
    expect(options).toMatchObject({ message_thread_id: 777 });
    expect(Array.isArray(mediaGroup)).toBe(true);
    expect(mediaGroup).toHaveLength(2);
    expect(mediaGroup?.[0]).toMatchObject({ type: 'photo', parse_mode: 'MarkdownV2' });
    expect(mediaGroup?.[1]).toMatchObject({ type: 'photo' });
    expect(editMessageCaptionMock).toHaveBeenCalledWith(
      chatId,
      601,
      undefined,
      mediaGroup?.[0]?.caption,
      expect.objectContaining({
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: [] },
      }),
    );
    expect(editMessageReplyMarkupMock).toHaveBeenCalledWith(
      chatId,
      601,
      undefined,
      { inline_keyboard: [] },
    );

    const collageDir = path.join(os.tmpdir(), 'erm-task-collages');
    const collageFiles = await fs.readdir(collageDir).catch(() => []);
    const hasGenerated = collageFiles.some((name) => name.startsWith('collage_'));
    expect(hasGenerated).toBe(false);
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
        telegram_preview_message_ids: [101],
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

  it(
    'сохраняет новый идентификатор, вложения и cleanup при ошибке удаления старого сообщения',
    async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const previous = {
        telegram_message_id: 333,
        telegram_topic_id: 888,
        telegram_attachments_message_ids: [777],
        attachments: [
          {
            url: 'https://cdn.example.com/old-extra.jpg',
            type: 'image/jpeg',
            name: 'old-extra',
          },
        ],
      } as Record<string, unknown>;
      const freshPlain = {
        _id: '507f1f77bcf86cd799439013',
        telegram_message_id: 333,
        telegram_topic_id: 888,
        telegram_attachments_message_ids: [777],
        telegram_preview_message_ids: [],
        assigned_user_id: 55,
        assignees: [55],
        created_by: 55,
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
      const preparePreviewMediaSpy = jest
        .spyOn(TasksController.prototype as any, 'preparePreviewMedia')
        .mockResolvedValue(null);
      const sendTaskMessageWithPreviewSpy = jest
        .spyOn(TasksController.prototype as any, 'sendTaskMessageWithPreview')
        .mockResolvedValue({
          messageId: 444,
          usedPreview: false,
          cache: new Map(),
        });
      const sendTaskAttachmentsSpy = jest
        .spyOn(TasksController.prototype as any, 'sendTaskAttachments')
        .mockResolvedValue([901, 902]);
      const deleteAttachmentMessagesSpy = jest
        .spyOn(TasksController.prototype as any, 'deleteAttachmentMessages')
        .mockResolvedValue(undefined);
      const deleteTaskMessageSafelySpy = jest
        .spyOn(TasksController.prototype as any, 'deleteTaskMessageSafely')
        .mockResolvedValue(false);

      const controller = new TasksController({} as any);

      try {
        await (controller as any).syncTelegramTaskMessage(freshPlain._id, {
          ...previous,
        });

        expect(deleteTaskMessageSafelySpy).toHaveBeenCalled();
        expect(updateOneMock).toHaveBeenCalledTimes(1);
        const [filter, update] = updateOneMock.mock.calls[0];
        expect(filter).toMatchObject({
          _id: freshPlain._id,
          telegram_message_id: 333,
        });
        expect(update).toHaveProperty('$set.telegram_message_id', 444);
        expect(update).toHaveProperty('$set.telegram_attachments_message_ids');
        expect(update.$set.telegram_attachments_message_ids).toEqual([901, 902]);
        expect(update).toHaveProperty('$set.telegram_message_cleanup');
        expect(update.$set.telegram_message_cleanup).toMatchObject({
          chat_id: process.env.CHAT_ID,
          message_id: 333,
          new_message_id: 444,
          reason: 'delete-failed',
        });
        expect(update.$set.telegram_message_cleanup.attempted_at).toEqual(
          expect.any(String),
        );
        expect(warnSpy).toHaveBeenCalledWith(
          'Не удалось удалить предыдущее сообщение задачи, требуется ручная очистка',
          expect.objectContaining({
            taskId: freshPlain._id,
            cleanup: expect.objectContaining({
              message_id: 333,
              new_message_id: 444,
            }),
          }),
        );
      } finally {
        warnSpy.mockRestore();
        sendTaskMessageWithPreviewSpy.mockRestore();
        sendTaskAttachmentsSpy.mockRestore();
        deleteAttachmentMessagesSpy.mockRestore();
        deleteTaskMessageSafelySpy.mockRestore();
        preparePreviewMediaSpy.mockRestore();
      }
    },
  );
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

  it('не пересоздаёт вложение при ответе message is not modified', async () => {
    editMessageTextMock.mockResolvedValue(undefined);
    editMessageMediaMock
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(
        Object.assign(
          new Error(
            'Bad Request: message is not modified: specified new message content and reply markup are exactly the same',
          ),
          {
            response: {
              ok: false,
              error_code: 400,
              description:
                'Bad Request: message is not modified: specified new message content and reply markup are exactly the same',
            },
          },
        ),
      );

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

    await (controller as any).syncTelegramTaskMessage(
      '507f1f77bcf86cd799439011',
      previousState,
    );

    expect(editMessageMediaMock).toHaveBeenCalledTimes(2);
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
        telegram_preview_message_ids: [1002],
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
    expect(mainExtra).toMatchObject({
      reply_markup: { inline_keyboard: [] },
    });
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

  it('удаляет фотографии превью медиа-группы без «висячих» сообщений', async () => {
    const uploadsRoot = path.resolve(uploadsDir);
    const tempDir = path.join(uploadsRoot, 'tests-preview-cleanup-sync');
    await fs.mkdir(tempDir, { recursive: true });

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
      return { relative, size: stats.size };
    };

    const [oldFirst, oldSecond, nextFirst, nextSecond] = await Promise.all([
      createImage('old-first.jpg', '#111111'),
      createImage('old-second.jpg', '#222222'),
      createImage('next-first.jpg', '#333333'),
      createImage('next-second.jpg', '#444444'),
    ]);

    editMessageMediaMock.mockRejectedValueOnce(new Error('cannot edit media'));
    sendMediaGroupMock.mockResolvedValueOnce([
      { message_id: 801 },
      { message_id: 802 },
    ]);
    deleteMessageMock.mockResolvedValue(undefined);

    const freshPlain = {
      _id: '507f1f77bcf86cd799439022',
      task_number: 'A-12',
      title: 'Задача',
      telegram_message_id: 701,
      telegram_preview_message_ids: [701, 702],
      telegram_attachments_message_ids: [],
      telegram_topic_id: 777,
      attachments: [
        {
          url: `/api/v1/files/${nextFirst.relative}`,
          type: 'image/jpeg',
          name: 'next-first.jpg',
          size: nextFirst.size,
        },
        {
          url: `/api/v1/files/${nextSecond.relative}`,
          type: 'image/jpeg',
          name: 'next-second.jpg',
          size: nextSecond.size,
        },
      ],
      assignees: [55],
      assigned_user_id: 55,
      created_by: 55,
      request_id: 'REQ-1',
      createdAt: '2024-01-01T00:00:00Z',
    } as Record<string, unknown>;

    taskFindByIdMock.mockResolvedValueOnce({
      toObject() {
        return { ...freshPlain } as unknown as TaskDocument;
      },
    });

    const previousState = {
      ...freshPlain,
      attachments: [
        {
          url: `/api/v1/files/${oldFirst.relative}`,
          type: 'image/jpeg',
          name: 'old-first.jpg',
          size: oldFirst.size,
        },
        {
          url: `/api/v1/files/${oldSecond.relative}`,
          type: 'image/jpeg',
          name: 'old-second.jpg',
          size: oldSecond.size,
        },
      ],
    } as Record<string, unknown>;

    const controller = new TasksController({} as any);

    try {
      await (controller as any).syncTelegramTaskMessage(
        '507f1f77bcf86cd799439022',
        previousState,
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }

    const deletedIds = deleteMessageMock.mock.calls.map((call) => call[1]);
    expect(deletedIds).toEqual(expect.arrayContaining([701, 702]));
    const previewDeletionCalls = deleteMessageMock.mock.calls.filter(([, id]) =>
      id === 701 || id === 702,
    );
    expect(previewDeletionCalls).toHaveLength(2);
    expect(updateOneMock).toHaveBeenCalledTimes(1);
    const [updateFilter, updatePayload] = updateOneMock.mock.calls[0];
    expect(updateFilter).toMatchObject({ _id: '507f1f77bcf86cd799439022' });
    expect(updatePayload).toHaveProperty('$set');
    const setPayload = (updatePayload as { $set: Record<string, unknown> }).$set;
    const previewIds = (setPayload.telegram_preview_message_ids ?? []) as number[];
    expect(Array.isArray(previewIds)).toBe(true);
    expect(previewIds.length).toBeGreaterThan(0);
    expect(previewIds).toEqual(expect.not.arrayContaining([701, 702]));
    if (typeof setPayload.telegram_message_id === 'number') {
      expect(previewIds).toEqual(
        expect.arrayContaining([setPayload.telegram_message_id as number]),
      );
    }
  });

  it('очищает лишние фото при удалении превью из двух локальных изображений', async () => {
    const uploadsRoot = path.resolve(uploadsDir);
    const tempDir = path.join(uploadsRoot, 'tests-preview-remove-local');
    await fs.mkdir(tempDir, { recursive: true });

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
        .jpeg({ quality: 92 })
        .toFile(absolutePath);
      const relative = path.relative(uploadsRoot, absolutePath);
      const stats = await fs.stat(absolutePath);
      return { relative, size: stats.size };
    };

    const [first, second] = await Promise.all([
      createImage('first-local.jpg', '#550000'),
      createImage('second-local.jpg', '#005555'),
    ]);

    const freshPlain = {
      _id: '507f1f77bcf86cd799439099',
      task_number: 'A-13',
      title: 'Обновление задачи',
      telegram_message_id: 901,
      telegram_preview_message_ids: [],
      telegram_attachments_message_ids: [],
      telegram_topic_id: 777,
      attachments: [],
      assignees: [55],
      assigned_user_id: 55,
      created_by: 55,
      request_id: 'REQ-2',
      createdAt: '2024-01-01T00:00:00Z',
    } as Record<string, unknown>;

    taskFindByIdMock.mockResolvedValueOnce({
      toObject() {
        return { ...freshPlain } as unknown as TaskDocument;
      },
    });

    const previousState = {
      ...freshPlain,
      telegram_preview_message_ids: [901, 902],
      attachments: [
        {
          url: `/api/v1/files/${first.relative}`,
          type: 'image/jpeg',
          name: 'first-local.jpg',
          size: first.size,
        },
        {
          url: `/api/v1/files/${second.relative}`,
          type: 'image/jpeg',
          name: 'second-local.jpg',
          size: second.size,
        },
      ],
    } as Record<string, unknown>;

    const controller = new TasksController({} as any);

    try {
      await (controller as any).syncTelegramTaskMessage(
        '507f1f77bcf86cd799439099',
        previousState,
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }

    const deletedIds = deleteMessageMock.mock.calls.map((call) => call[1]);
    expect(deletedIds).toEqual(expect.arrayContaining([902]));
    expect(deletedIds).toEqual(expect.not.arrayContaining([901]));
    expect(updateOneMock).toHaveBeenCalledTimes(1);
    const [filter, payload] = updateOneMock.mock.calls[0];
    expect(filter).toMatchObject({ _id: '507f1f77bcf86cd799439099' });
    expect(payload).toHaveProperty('$set');
    const setPayload = (payload as { $set: Record<string, unknown> }).$set;
    const previewIds = (setPayload.telegram_preview_message_ids ?? []) as number[];
    expect(Array.isArray(previewIds)).toBe(true);
    expect(previewIds).toEqual([901]);
  });
});

