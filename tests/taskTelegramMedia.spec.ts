/**
 * Назначение файла: регрессия обрезки MarkdownV2-caption для Telegram-превью.
 * Основные модули: TaskTelegramMedia, jest.
 */

jest.mock('../apps/api/src/services/fileService', () => ({
  getFileRecord: jest.fn(async () => null),
  setTelegramFileId: jest.fn(async () => undefined),
}));

jest.mock('../apps/api/src/services/storage', () => ({
  getStorageBackend: jest.fn(() => ({
    read: jest.fn(async () => {
      throw new Error('storage.read should not be called in this test');
    }),
  })),
}));

import type { Context, Telegraf } from 'telegraf';
import { TaskTelegramMedia } from '../apps/api/src/tasks/taskTelegramMedia';
import type { FormatTaskSection } from '../apps/api/src/utils/formatTask';

describe('TaskTelegramMedia.sendTaskMessageWithPreview', () => {
  it('не переэкранирует уже подготовленный MarkdownV2-caption при обрезке первой секции', async () => {
    const sendPhoto = jest.fn(async () => ({ message_id: 321 }));
    const bot = {
      telegram: {
        sendPhoto,
        sendMessage: jest.fn(async () => ({ message_id: 654 })),
        sendDocument: jest.fn(async () => ({ message_id: 987 })),
        sendMediaGroup: jest.fn(),
        editMessageReplyMarkup: jest.fn(),
      },
    } as unknown as Telegraf<Context>;

    const mediaService = new TaskTelegramMedia(bot, {
      baseAppUrl: 'https://example.com',
    });

    const escapedLine = '\\_'.repeat(700);
    const sections: FormatTaskSection[] = [
      { key: 'description', content: escapedLine },
    ];

    await mediaService.sendTaskMessageWithPreview(
      1,
      escapedLine,
      sections,
      {
        previewImage: { kind: 'image', url: 'https://example.com/image.jpg' },
        extras: [],
        collageCandidates: [],
      },
      undefined,
    );

    expect(sendPhoto).toHaveBeenCalledTimes(1);
    const [, , options] = sendPhoto.mock.calls[0];
    expect(options.parse_mode).toBe('MarkdownV2');
    expect(options.caption.endsWith('…')).toBe(true);
    expect(options.caption.length).toBeLessThanOrEqual(1024);
    expect(options.caption).not.toContain('\\\\\\_');
    expect(options.caption.startsWith(escapedLine.slice(0, 100))).toBe(true);
  });
});
