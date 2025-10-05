// Контроллер задач с использованием TasksService
// Основные модули: express-validator, services, wgLogEngine, taskHistory.service, utils/mdEscape
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { handleValidation } from '../utils/validate';
import { TOKENS } from '../di/tokens';
import type TasksService from './tasks.service';
import { writeLog } from '../services/service';
import { getUsersMap } from '../db/queries';
import type { RequestWithUser } from '../types/request';
import {
  Task,
  File,
  type TaskDocument,
  type Attachment,
  type FileDocument,
} from '../db/model';
import { sendProblem } from '../utils/problem';
import { sendCached } from '../utils/sendCached';
import { type Task as SharedTask } from 'shared';
import { bot } from '../bot/bot';
import { chatId as groupChatId, appUrl as baseAppUrl } from '../config';
import taskStatusKeyboard from '../utils/taskButtons';
import formatTask, { type InlineImage } from '../utils/formatTask';
import buildChatMessageLink from '../utils/messageLink';
import { uploadsDir } from '../config/storage';
import {
  getTaskHistoryMessage,
  updateTaskHistoryMessageId,
  updateTaskSummaryMessageId,
} from './taskHistory.service';
import escapeMarkdownV2 from '../utils/mdEscape';
import {
  buildActionMessage,
  buildHistorySummaryLog,
  getTaskIdentifier,
} from './taskMessages';
import sharp from 'sharp';

type TaskEx = SharedTask & {
  controllers?: number[];
  created_by?: number;
  history?: { changed_by: number }[];
  telegram_attachments_message_ids?: number[];
  telegram_preview_message_ids?: number[];
};

type TaskWithMeta = TaskDocument & {
  telegram_attachments_message_ids?: number[];
  telegram_preview_message_ids?: number[];
};

const FILE_ID_REGEXP = /\/api\/v1\/files\/([0-9a-f]{24})(?=$|[/?#])/i;
const uploadsAbsoluteDir = path.resolve(uploadsDir);

const baseAppHost = (() => {
  try {
    return new URL(baseAppUrl).host;
  } catch {
    return null;
  }
})();

type LocalPhotoInfo = {
  absolutePath: string;
  filename: string;
  contentType?: string;
  size?: number;
};

const HTTP_URL_REGEXP = /^https?:\/\//i;
const YOUTUBE_URL_REGEXP =
  /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\//i;

const attachmentsBaseUrl = baseAppUrl.replace(/\/+$/, '');

const toAbsoluteAttachmentUrl = (url: string): string | null => {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (HTTP_URL_REGEXP.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  if (!attachmentsBaseUrl) {
    return null;
  }
  const normalizedPath = trimmed.startsWith('/')
    ? trimmed.slice(1)
    : trimmed;
  return `${attachmentsBaseUrl}/${normalizedPath}`;
};

type NormalizedAttachment =
  | { kind: 'image'; url: string; caption?: string }
  | {
      kind: 'unsupported-image';
      url: string;
      caption?: string;
      mimeType?: string;
      name?: string;
      size?: number;
    }
  | { kind: 'youtube'; url: string; title?: string };

type NormalizedImage = Extract<NormalizedAttachment, { kind: 'image' }>;

type TaskMedia = {
  previewImage: NormalizedImage | null;
  extras: NormalizedAttachment[];
  collageCandidates: NormalizedImage[];
};

type CollageCell = {
  width: number;
  height: number;
  left: number;
  top: number;
};

type CollageLayout = {
  width: number;
  height: number;
  cells: CollageCell[];
};

const COLLAGE_LAYOUTS: Record<number, CollageLayout> = {
  2: {
    width: 1200,
    height: 900,
    cells: [
      { width: 600, height: 900, left: 0, top: 0 },
      { width: 600, height: 900, left: 600, top: 0 },
    ],
  },
  3: {
    width: 1200,
    height: 900,
    cells: [
      { width: 600, height: 900, left: 0, top: 0 },
      { width: 600, height: 450, left: 600, top: 0 },
      { width: 600, height: 450, left: 600, top: 450 },
    ],
  },
  4: {
    width: 1200,
    height: 900,
    cells: [
      { width: 600, height: 450, left: 0, top: 0 },
      { width: 600, height: 450, left: 600, top: 0 },
      { width: 600, height: 450, left: 0, top: 450 },
      { width: 600, height: 450, left: 600, top: 450 },
    ],
  },
};

type SendMessageOptions = NonNullable<
  Parameters<typeof bot.telegram.sendMessage>[2]
>;
type EditMessageTextOptions = NonNullable<
  Parameters<typeof bot.telegram.editMessageText>[4]
>;

type TaskMessageSendResult = {
  messageId: number | undefined;
  usedPreview: boolean;
  cache: Map<string, LocalPhotoInfo | null>;
  previewSourceUrls?: string[];
  previewMessageIds?: number[];
};
type SendPhotoOptions = NonNullable<
  Parameters<typeof bot.telegram.sendPhoto>[2]
>;
type SendDocumentOptions = NonNullable<
  Parameters<typeof bot.telegram.sendDocument>[2]
>;
type PhotoInput = Parameters<typeof bot.telegram.sendPhoto>[1];

const SUPPORTED_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

@injectable()
export default class TasksController {
  constructor(@inject(TOKENS.TasksService) private service: TasksService) {}

  private collectNotificationTargets(task: Partial<TaskDocument>, creatorId?: number) {
    const recipients = new Set<number>();
    const add = (value: unknown) => {
      const num = Number(value);
      if (!Number.isNaN(num) && Number.isFinite(num) && num !== 0)
        recipients.add(num);
    };
    add(task.assigned_user_id);
    if (Array.isArray(task.assignees)) task.assignees.forEach(add);
    add(task.controller_user_id);
    if (Array.isArray(task.controllers)) task.controllers.forEach(add);
    add(task.created_by);
    if (creatorId !== undefined) add(creatorId);
    return recipients;
  }

  private collectAssignees(task: Partial<TaskDocument>) {
    const recipients = new Set<number>();
    const add = (value: unknown) => {
      const num = Number(value);
      if (!Number.isNaN(num) && Number.isFinite(num) && num !== 0) {
        recipients.add(num);
      }
    };
    add(task.assigned_user_id);
    if (Array.isArray(task.assignees)) task.assignees.forEach(add);
    return recipients;
  }

  private async resolvePhotoInputWithCache(
    url: string,
    cache: Map<string, LocalPhotoInfo | null>,
  ): Promise<PhotoInput> {
    if (!url) return url;
    if (!cache.has(url)) {
      const info = await this.resolveLocalPhotoInfo(url);
      const prepared = info ? await this.ensurePhotoWithinLimit(info) : info;
      cache.set(url, prepared);
    }
    let info = cache.get(url);
    if (!info) {
      return url;
    }
    info = await this.ensurePhotoWithinLimit(info);
    cache.set(url, info);
    try {
      const stream = createReadStream(info.absolutePath);
      await new Promise<void>((resolve, reject) => {
        const handleOpen = () => {
          stream.off('error', handleError);
          resolve();
        };
        const handleError = (streamError: NodeJS.ErrnoException) => {
          stream.off('open', handleOpen);
          reject(streamError);
        };
        stream.once('open', handleOpen);
        stream.once('error', handleError);
      });
      const descriptor = {
        source: stream,
        filename: info.filename,
        ...(info.contentType ? { contentType: info.contentType } : {}),
      };
      return descriptor as PhotoInput;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        console.error(
          `Не удалось открыть файл ${info.absolutePath} для отправки в Telegram`,
          error,
        );
      }
      cache.set(url, null);
      return url;
    }
  }

  private normalizeInlineImages(inline: InlineImage[] | undefined) {
    if (!inline?.length) return [] as NormalizedImage[];
    const result: NormalizedImage[] = [];
    inline.forEach((image) => {
      if (!image?.url) return;
      const absolute = toAbsoluteAttachmentUrl(image.url);
      if (!absolute) return;
      const hasInlineParam = /[?&]mode=inline(?:&|$)/.test(absolute);
      const url = hasInlineParam
        ? absolute
        : `${absolute}${absolute.includes('?') ? '&' : '?'}mode=inline`;
      const caption = image.alt && image.alt.trim() ? image.alt.trim() : undefined;
      const payload: NormalizedImage = { kind: 'image', url };
      if (caption) {
        payload.caption = caption;
      }
      result.push(payload);
    });
    return result;
  }

  private collectSendableAttachments(
    task: Partial<TaskDocument>,
    inline: InlineImage[] | undefined,
  ): TaskMedia {
    const previewPool: NormalizedImage[] = [];
    const extras: NormalizedAttachment[] = [];
    const collageCandidates: NormalizedImage[] = [];
    const extrasSeen = new Set<string>();
    const registerExtra = (attachment: NormalizedAttachment) => {
      const key = `${attachment.kind}:${attachment.url}`;
      if (extrasSeen.has(key)) {
        return;
      }
      extrasSeen.add(key);
      extras.push(attachment);
    };
    const registerImage = (image: NormalizedImage) => {
      previewPool.push(image);
      registerExtra(image);
      if (this.extractLocalFileId(image.url)) {
        collageCandidates.push(image);
      }
    };
    this.normalizeInlineImages(inline).forEach(registerImage);
    if (Array.isArray(task.attachments) && task.attachments.length > 0) {
      task.attachments.forEach((attachment: Attachment | null | undefined) => {
        if (!attachment || typeof attachment.url !== 'string') return;
        const url = attachment.url.trim();
        if (!url) return;
        if (YOUTUBE_URL_REGEXP.test(url)) {
          const title =
            typeof attachment.name === 'string' && attachment.name.trim()
              ? attachment.name.trim()
              : undefined;
          registerExtra({ kind: 'youtube', url, title });
          return;
        }
        const type =
          typeof attachment.type === 'string'
            ? attachment.type.trim().toLowerCase()
            : '';
        if (!type.startsWith('image/')) return;
        const absolute = toAbsoluteAttachmentUrl(url);
        if (!absolute) return;
        const [mimeType] = type.split(';', 1);
        const name =
          typeof attachment.name === 'string' && attachment.name.trim()
            ? attachment.name.trim()
            : undefined;
        const size =
          typeof attachment.size === 'number' && Number.isFinite(attachment.size)
            ? attachment.size
            : undefined;
        if (mimeType && SUPPORTED_PHOTO_MIME_TYPES.has(mimeType)) {
          if (size !== undefined && size > MAX_PHOTO_SIZE_BYTES) {
            const localId = this.extractLocalFileId(absolute);
            if (!localId) {
              registerExtra({
                kind: 'unsupported-image',
                url: absolute,
                mimeType,
                name,
                size,
              });
              return;
            }
            registerImage({ kind: 'image', url: absolute });
            return;
          }
          registerImage({ kind: 'image', url: absolute });
          return;
        }
        registerExtra({
          kind: 'unsupported-image',
          url: absolute,
          mimeType,
          name,
          ...(size !== undefined ? { size } : {}),
        });
      });
    }
    const previewImage = previewPool.length ? previewPool[0] : null;
    const shouldKeepPreviewInExtras =
      !!previewImage && this.extractLocalFileId(previewImage.url) !== null;
    const extrasWithoutPreview =
      previewImage && !shouldKeepPreviewInExtras
        ? (() => {
            let removed = false;
            return extras.filter((attachment) => {
              if (attachment.kind !== 'image') {
                return true;
              }
              if (!removed && attachment === previewImage) {
                removed = true;
                return false;
              }
              return true;
            });
          })()
        : extras;
    return {
      previewImage,
      extras: extrasWithoutPreview,
      collageCandidates,
    };
  }

  private async sendTaskMessageWithPreview(
    chat: string | number,
    message: string,
    media: TaskMedia,
    keyboard: ReturnType<typeof taskStatusKeyboard>,
    topicId?: number,
  ): Promise<TaskMessageSendResult> {
    const cache = new Map<string, LocalPhotoInfo | null>();
    const uniqueCandidates: NormalizedImage[] = [];
    const keyboardMarkup = this.extractKeyboardMarkup(keyboard);
    if (media.collageCandidates.length >= 2) {
      const seen = new Set<string>();
      for (const candidate of media.collageCandidates) {
        if (!candidate?.url || seen.has(candidate.url)) {
          continue;
        }
        seen.add(candidate.url);
        uniqueCandidates.push(candidate);
        if (uniqueCandidates.length >= 10) {
          break;
        }
      }
    }
    if (uniqueCandidates.length >= 2) {
      try {
        const mediaGroup = await Promise.all(
          uniqueCandidates.map(async (candidate, index) => {
            const descriptor: Parameters<
              typeof bot.telegram.sendMediaGroup
            >[1][number] = {
              type: 'photo',
              media: await this.resolvePhotoInputWithCache(candidate.url, cache),
            };
            if (index === 0) {
              descriptor.caption = message;
              descriptor.parse_mode = 'MarkdownV2';
            } else if (candidate.caption) {
              descriptor.caption = escapeMarkdownV2(candidate.caption);
              descriptor.parse_mode = 'MarkdownV2';
            }
            return descriptor;
          }),
        );
        const options: Parameters<typeof bot.telegram.sendMediaGroup>[2] = {};
        if (typeof topicId === 'number') {
          options.message_thread_id = topicId;
        }
        const response = await bot.telegram.sendMediaGroup(
          chat,
          mediaGroup,
          options,
        );
        const responseList = Array.isArray(response) ? response : [];
        const previewMessageIds = responseList
          .map((item) =>
            item && typeof item.message_id === 'number' ? item.message_id : null,
          )
          .filter(
            (value): value is number => value !== null && Number.isFinite(value),
          );
        const firstMessage = responseList[0];
        const messageId = firstMessage?.message_id;
        if (messageId && keyboard) {
          const replyMarkup = keyboardMarkup ?? this.extractKeyboardMarkup(keyboard);
          try {
            await bot.telegram.editMessageCaption(chat, messageId, undefined, message, {
              parse_mode: 'MarkdownV2',
              ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
            });
          } catch (error) {
            if (!this.isMessageNotModifiedError(error)) {
              console.error(
                'Не удалось обновить подпись первого сообщения медиа-группы',
                error,
              );
            }
          }
          if (replyMarkup) {
            try {
              await bot.telegram.editMessageReplyMarkup(
                chat,
                messageId,
                undefined,
                replyMarkup,
              );
            } catch (error) {
              if (!this.isMessageNotModifiedError(error)) {
                console.error(
                  'Не удалось применить клавиатуру к первому сообщению медиа-группы',
                  error,
                );
              }
            }
          }
        }
        if (!messageId) {
          throw new Error('Telegram не вернул идентификатор первого сообщения');
        }
        return {
          messageId,
          usedPreview: true,
          cache,
          previewSourceUrls: uniqueCandidates.map((item) => item.url),
          previewMessageIds,
        };
      } catch (error) {
        console.warn(
          'Не удалось отправить медиа-группу для превью, используем одиночное фото',
          error,
        );
      }
    }
    const prepared = await this.preparePreviewMedia(media, cache);
    if (prepared) {
      const { photo, cleanup, sourceUrl } = prepared;
      try {
        const options: SendPhotoOptions = {
          caption: message,
          parse_mode: 'MarkdownV2',
          ...(keyboardMarkup ? { reply_markup: keyboardMarkup } : {}),
        };
        if (typeof topicId === 'number') {
          options.message_thread_id = topicId;
        }
        const response = await bot.telegram.sendPhoto(chat, photo, options);
        if (cleanup) {
          await cleanup();
        }
        return {
          messageId: response?.message_id,
          usedPreview: true,
          cache,
          previewSourceUrls: [sourceUrl],
          previewMessageIds:
            typeof response?.message_id === 'number'
              ? [response.message_id]
              : undefined,
        };
      } catch (error) {
        if (cleanup) {
          await cleanup().catch(() => undefined);
        }
        if (!this.shouldFallbackToTextMessage(error)) {
          throw error;
        }
        console.warn(
          'Не удалось отправить задачу как фото, используем текстовый формат',
          error,
        );
      }
    }
    const options: SendMessageOptions = {
      parse_mode: 'MarkdownV2',
      link_preview_options: media.previewImage
        ? this.createPreviewOptions(media.previewImage)
        : { is_disabled: true },
      ...(keyboardMarkup ? { reply_markup: keyboardMarkup } : {}),
    };
    if (typeof topicId === 'number') {
      options.message_thread_id = topicId;
    }
    const response = await bot.telegram.sendMessage(chat, message, options);
    return {
      messageId: response?.message_id,
      usedPreview: false,
      cache,
      previewSourceUrls: undefined,
      previewMessageIds: undefined,
    };
  }

  private async editTaskMessageWithPreview(
    chat: string | number,
    messageId: number,
    message: string,
    media: TaskMedia,
    keyboard: ReturnType<typeof taskStatusKeyboard>,
  ): Promise<{
    success: boolean;
    usedPreview: boolean;
    cache: Map<string, LocalPhotoInfo | null>;
    previewSourceUrls?: string[];
  }>
  {
    const cache = new Map<string, LocalPhotoInfo | null>();
    const replyMarkup = this.extractKeyboardMarkup(keyboard);
    const prepared = await this.preparePreviewMedia(media, cache);
    if (prepared) {
      const { photo, cleanup, sourceUrl } = prepared;
      try {
        const editMedia: Parameters<typeof bot.telegram.editMessageMedia>[3] = {
          type: 'photo',
          media: photo,
          caption: message,
          parse_mode: 'MarkdownV2',
        };
        await bot.telegram.editMessageMedia(
          chat,
          messageId,
          undefined,
          editMedia,
          replyMarkup ? { reply_markup: replyMarkup } : undefined,
        );
        if (cleanup) {
          await cleanup();
        }
        return {
          success: true,
          usedPreview: true,
          cache,
          previewSourceUrls: [sourceUrl],
        };
      } catch (error) {
        if (cleanup) {
          await cleanup().catch(() => undefined);
        }
        if (this.isMessageNotModifiedError(error)) {
          return {
            success: true,
            usedPreview: true,
            cache,
            previewSourceUrls: [sourceUrl],
          };
        }
        if (this.isMediaMessageTypeError(error)) {
          // Сообщение не является медиа, пробуем текстовое обновление ниже.
        } else if (this.shouldFallbackToTextMessage(error)) {
          console.warn(
            'Не удалось обновить сообщение задачи как фото, пробуем текст',
            error,
          );
        } else {
          console.error('Не удалось обновить сообщение задачи (фото)', error);
          return { success: false, usedPreview: false, cache };
        }
      }
    }
    try {
      await bot.telegram.editMessageText(chat, messageId, undefined, message, {
        parse_mode: 'MarkdownV2',
        link_preview_options: media.previewImage
          ? this.createPreviewOptions(media.previewImage)
          : { is_disabled: true },
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      });
      return { success: true, usedPreview: false, cache, previewSourceUrls: undefined };
    } catch (error) {
      if (this.isMessageNotModifiedError(error)) {
        return { success: true, usedPreview: false, cache, previewSourceUrls: undefined };
      }
      return { success: false, usedPreview: false, cache, previewSourceUrls: undefined };
    }
  }

  private async ensurePhotoWithinLimit(
    info: LocalPhotoInfo,
  ): Promise<LocalPhotoInfo> {
    try {
      let current = info;
      let currentSize = current.size;
      if (currentSize === undefined) {
        try {
          const fileStat = await stat(current.absolutePath);
          currentSize = fileStat.size;
          current = { ...current, size: currentSize };
        } catch (error) {
          console.error(
            'Не удалось определить размер изображения для Telegram',
            current.absolutePath,
            error,
          );
        }
      }
      if (currentSize !== undefined && currentSize <= MAX_PHOTO_SIZE_BYTES) {
        return current;
      }
      const compressed = await this.createCompressedPhoto(current);
      return compressed ?? current;
    } catch (error) {
      console.error(
        'Не удалось подготовить изображение для Telegram',
        info.absolutePath,
        error,
      );
      return info;
    }
  }

  private async createCompressedPhoto(
    info: LocalPhotoInfo,
  ): Promise<LocalPhotoInfo | null> {
    try {
      const metadata = await sharp(info.absolutePath).metadata();
      const baseWidth = metadata.width ?? null;
      const hasAlpha = metadata.hasAlpha === true;
      let width = baseWidth ?? null;
      let quality = 90;
      let buffer: Buffer | null = null;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        let pipeline = sharp(info.absolutePath);
        if (width && baseWidth && width < baseWidth) {
          pipeline = pipeline.resize({
            width,
            fit: 'inside',
            withoutEnlargement: true,
          });
        }
        if (hasAlpha) {
          pipeline = pipeline.flatten({ background: '#ffffff' });
        }
        pipeline = pipeline.jpeg({ quality, progressive: true });
        buffer = await pipeline.toBuffer();
        if (buffer.length <= MAX_PHOTO_SIZE_BYTES) {
          break;
        }
        if (quality > 45) {
          quality = Math.max(40, quality - 15);
          continue;
        }
        if (width && width > 640) {
          width = Math.max(640, Math.floor(width * 0.85));
          continue;
        }
        if (width && width > 320) {
          width = Math.max(320, Math.floor(width * 0.8));
          continue;
        }
        break;
      }
      if (!buffer || buffer.length > MAX_PHOTO_SIZE_BYTES) {
        return null;
      }
      const cacheDir = path.join(os.tmpdir(), 'erm-telegram-images');
      await mkdir(cacheDir, { recursive: true });
      const tempName = `${randomBytes(12).toString('hex')}.jpg`;
      const outputPath = path.join(cacheDir, tempName);
      await writeFile(outputPath, buffer);
      const finalName = `${path.parse(info.filename).name}-compressed.jpg`;
      return {
        absolutePath: outputPath,
        filename: finalName,
        contentType: 'image/jpeg',
        size: buffer.length,
      };
    } catch (error) {
      console.error(
        'Не удалось сжать изображение для Telegram',
        info.absolutePath,
        error,
      );
      return null;
    }
  }

  private getCollageLayout(count: number): CollageLayout | null {
    if (count < 2) {
      return null;
    }
    const normalized = Math.min(Math.max(count, 2), 4);
    return COLLAGE_LAYOUTS[normalized] ?? null;
  }

  private async createCollageFromCandidates(
    candidates: NormalizedImage[],
    cache: Map<string, LocalPhotoInfo | null>,
  ): Promise<{ key: string; cleanup: () => Promise<void> } | null> {
    return this.buildCollageFromCandidates(candidates, cache).catch((error) => {
      console.error('Не удалось создать коллаж вложений', error);
      return null;
    });
  }

  private async buildCollageFromCandidates(
    candidates: NormalizedImage[],
    cache: Map<string, LocalPhotoInfo | null>,
  ): Promise<{ key: string; cleanup: () => Promise<void> } | null> {
    const seen = new Set<string>();
    const infos: LocalPhotoInfo[] = [];
    for (const candidate of candidates) {
      if (!candidate?.url || seen.has(candidate.url)) {
        continue;
      }
      seen.add(candidate.url);
      let info = cache.get(candidate.url) ?? null;
      if (!cache.has(candidate.url)) {
        info = (await this.resolveLocalPhotoInfo(candidate.url)) ?? null;
        cache.set(candidate.url, info);
      }
      if (info) {
        infos.push(info);
      }
      if (infos.length >= 4) {
        break;
      }
    }
    if (infos.length < 2) {
      return null;
    }
    const layout = this.getCollageLayout(infos.length);
    if (!layout) {
      return null;
    }
    const composites = await Promise.all(
      infos.map(async (info, index) => {
        const cell = layout.cells[index];
        const buffer = await sharp(info.absolutePath)
          .resize(cell.width, cell.height, {
            fit: 'cover',
            position: 'attention',
          })
          .jpeg({ quality: 85 })
          .toBuffer();
        return { input: buffer, left: cell.left, top: cell.top };
      }),
    );
    const outputDir = path.join(os.tmpdir(), 'erm-task-collages');
    await mkdir(outputDir, { recursive: true });
    const filename = `collage_${Date.now()}_${randomBytes(6).toString('hex')}.jpg`;
    const target = path.join(outputDir, filename);
    const outputBuffer = await sharp({
      create: {
        width: layout.width,
        height: layout.height,
        channels: 3,
        background: '#ffffff',
      },
    })
      .composite(composites)
      .jpeg({ quality: 82 })
      .toBuffer();
    await writeFile(target, outputBuffer);
    const key = `local-collage:${filename}`;
    cache.set(key, {
      absolutePath: target,
      filename,
      contentType: 'image/jpeg',
      size: outputBuffer.length,
    });
    return {
      key,
      cleanup: async () => {
        cache.delete(key);
        await unlink(target).catch(() => undefined);
      },
    };
  }


  private async preparePreviewMedia(
    media: TaskMedia,
    cache: Map<string, LocalPhotoInfo | null>,
  ): Promise<
    | { photo: PhotoInput; sourceUrl: string; cleanup?: () => Promise<void> }
    | null
  > {
    const preview = media.previewImage;
    if (!preview) {
      return null;
    }
    const sourceUrl = preview.url;
    const photo = await this.resolvePhotoInputWithCache(sourceUrl, cache);
    return { photo, sourceUrl };
  }

  private createPreviewOptions(
    image: NormalizedImage | null,
  ): NonNullable<SendMessageOptions['link_preview_options']> {
    if (!image) {
      return { is_disabled: true };
    }
    return {
      url: image.url,
      prefer_large_media: true,
      show_above_text: true,
    };
  }

  private extractKeyboardMarkup(
    keyboard: ReturnType<typeof taskStatusKeyboard>,
  ): Parameters<typeof bot.telegram.editMessageReplyMarkup>[3] | undefined {
    if (!keyboard || typeof keyboard !== 'object') {
      return undefined;
    }
    const candidate = keyboard as {
      reply_markup?: unknown;
      inline_keyboard?: unknown;
    };
    if (candidate.reply_markup && typeof candidate.reply_markup === 'object') {
      return candidate.reply_markup as Parameters<
        typeof bot.telegram.editMessageReplyMarkup
      >[3];
    }
    if (Array.isArray(candidate.inline_keyboard)) {
      return {
        inline_keyboard: candidate.inline_keyboard,
      } as Parameters<typeof bot.telegram.editMessageReplyMarkup>[3];
    }
    return undefined;
  }

  private extractLocalFileId(url: string): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url, baseAppUrl);
      if (baseAppHost && parsed.host && parsed.host !== baseAppHost) {
        return null;
      }
      const match = FILE_ID_REGEXP.exec(parsed.pathname);
      return match ? match[1] : null;
    } catch {
      const normalized = url.startsWith('/') ? url : `/${url}`;
      const match = FILE_ID_REGEXP.exec(normalized);
      return match ? match[1] : null;
    }
  }

  private readonly botApiPhotoErrorPatterns: RegExp[] = [
    /\bIMAGE_PROCESS_FAILED\b/,
    /\bPHOTO_[A-Z_]+\b/,
    /\bFILE_TOO_BIG\b/,
    /\bFILE_UPLOAD_[A-Z_]+\b/,
    /\bFILE_SIZE_[A-Z_]+\b/,
  ];

  private extractPhotoErrorCode(error: unknown): string | null {
    if (!error || typeof error !== 'object') {
      return null;
    }
    const {
      response,
      description,
      message,
      cause,
    } = error as {
      response?: { description?: unknown };
      description?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    const candidates = new Set<string>();
    if (typeof response?.description === 'string') {
      candidates.add(response.description);
    }
    if (typeof description === 'string') {
      candidates.add(description);
    }
    if (typeof message === 'string') {
      candidates.add(message);
    }
    if (error instanceof Error && typeof error.message === 'string') {
      candidates.add(error.message);
    }
    const causeDescription =
      cause && typeof cause === 'object'
        ? (cause as { description?: unknown; message?: unknown }).description
        : undefined;
    if (typeof causeDescription === 'string') {
      candidates.add(causeDescription);
    }
    const causeMessage =
      cause && typeof cause === 'object'
        ? (cause as { message?: unknown }).message
        : undefined;
    if (typeof causeMessage === 'string') {
      candidates.add(causeMessage);
    }
    for (const candidate of candidates) {
      for (const pattern of this.botApiPhotoErrorPatterns) {
        const match = candidate.match(pattern);
        if (match && match[0]) {
          return match[0];
        }
      }
    }
    return null;
  }

  private isImageProcessFailedError(error: unknown): boolean {
    return this.extractPhotoErrorCode(error) !== null;
  }

  private isCaptionTooLongError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const { description, message } = error as {
      description?: unknown;
      message?: unknown;
    };
    const descriptionText =
      typeof description === 'string' ? description.toLowerCase() : '';
    const messageText = typeof message === 'string' ? message.toLowerCase() : '';
    return (
      descriptionText.includes('caption is too long') ||
      messageText.includes('caption is too long')
    );
  }

  private isMediaMessageTypeError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const { description, message } = error as {
      description?: unknown;
      message?: unknown;
    };
    const descriptionText =
      typeof description === 'string' ? description.toLowerCase() : '';
    const messageText = typeof message === 'string' ? message.toLowerCase() : '';
    return (
      descriptionText.includes('message is not a media message') ||
      messageText.includes('message is not a media message')
    );
  }

  private shouldFallbackToTextMessage(error: unknown): boolean {
    return (
      this.isImageProcessFailedError(error) || this.isCaptionTooLongError(error)
    );
  }

  private async resolveLocalPhotoInfo(url: string): Promise<LocalPhotoInfo | null> {
    const fileId = this.extractLocalFileId(url);
    if (!fileId) return null;
    try {
      const fileModel = File as
        | (typeof File & {
            findById?: typeof File.findById;
          })
        | undefined;
      if (!fileModel || typeof fileModel.findById !== 'function') {
        return null;
      }
      const query = fileModel.findById(fileId);
      const record =
        query && typeof (query as unknown as { lean?: () => unknown }).lean === 'function'
          ? await (query as unknown as { lean: () => Promise<FileDocument | null> }).lean()
          : ((await query) as unknown as FileDocument | null);
      if (!record || typeof record.path !== 'string' || !record.path.trim()) {
        return null;
      }
      const normalizedPath = record.path.trim();
      const target = path.resolve(uploadsAbsoluteDir, normalizedPath);
      const relative = path.relative(uploadsAbsoluteDir, target);
      if (
        !relative ||
        relative.startsWith('..') ||
        path.isAbsolute(relative)
      ) {
        return null;
      }
      await access(target);
      const filenameSource =
        typeof record.name === 'string' && record.name.trim()
          ? record.name.trim()
          : normalizedPath;
      const filename = path.basename(filenameSource);
      const contentType =
        typeof record.type === 'string' && record.type.trim()
          ? record.type.trim()
          : undefined;
      let size =
        typeof record.size === 'number' && Number.isFinite(record.size)
          ? record.size
          : undefined;
      if (size === undefined) {
        try {
          const fileStat = await stat(target);
          size = fileStat.size;
        } catch (error) {
          console.error(
            'Не удалось получить размер файла вложения',
            target,
            error,
          );
        }
      }
      return { absolutePath: target, filename, contentType, size };
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        console.error(
          `Не удалось подготовить файл ${url} для отправки в Telegram`,
          error,
        );
      }
      return null;
    }
  }

  private areNormalizedAttachmentsEqual(
    previous: NormalizedAttachment[],
    next: NormalizedAttachment[],
  ): boolean {
    if (previous.length !== next.length) return false;
    return previous.every((item, index) => {
      const candidate = next[index];
      if (!candidate) return false;
      if (item.kind !== candidate.kind) return false;
      if (item.url !== candidate.url) return false;
      if (item.kind === 'youtube' && candidate.kind === 'youtube') {
        return item.title === candidate.title;
      }
      if (item.kind === 'image' && candidate.kind === 'image') {
        return (item.caption ?? '') === (candidate.caption ?? '');
      }
      return true;
    });
  }

  private areMessageIdListsEqual(left: number[], right: number[]) {
    if (left.length !== right.length) return false;
    return left.every((value, index) => right[index] === value);
  }

  private async deleteAttachmentMessages(
    chat: string | number,
    messageIds: number[],
  ) {
    if (!messageIds.length) return;
    await Promise.all(
      messageIds.map(async (messageId) => {
        if (!Number.isFinite(messageId)) return;
        try {
          await bot.telegram.deleteMessage(chat, messageId);
        } catch (error) {
          console.error(
            `Не удалось удалить сообщение вложений ${messageId}`,
            error,
          );
        }
      }),
    );
  }

  private normalizeTopicId(value: unknown): number | undefined {
    if (typeof value !== 'number') return undefined;
    return Number.isFinite(value) ? value : undefined;
  }

  private areTopicsEqual(left?: number, right?: number): boolean {
    if (typeof left === 'number' && typeof right === 'number') {
      return left === right;
    }
    return typeof left === 'undefined' && typeof right === 'undefined';
  }

  private async deleteTaskMessageSafely(
    chat: string | number,
    messageId: number,
    expectedTopic?: number,
    actualTopic?: number,
  ): Promise<boolean> {
    if (!Number.isFinite(messageId)) {
      return false;
    }
    if (!this.areTopicsEqual(expectedTopic, actualTopic)) {
      console.warn(
        'Пропускаем удаление сообщения задачи из другой темы',
        {
          expectedTopic,
          actualTopic,
          messageId,
        },
      );
      return false;
    }
    try {
      await bot.telegram.deleteMessage(chat, messageId);
      return true;
    } catch (error) {
      console.error(
        `Не удалось удалить сообщение ${messageId} задачи в Telegram`,
        error,
      );
      return false;
    }
  }

  private async updateTaskTelegramFields(
    taskId: string,
    set: Record<string, unknown>,
    unset: Record<string, unknown>,
    guard?: { field: 'telegram_message_id'; previous: number | null },
  ): Promise<void> {
    const update: Record<string, unknown> = {};
    if (Object.keys(set).length) {
      update.$set = set;
    }
    if (Object.keys(unset).length) {
      update.$unset = unset;
    }
    if (!Object.keys(update).length) {
      return;
    }
    const filter: Record<string, unknown> = { _id: taskId };
    if (guard) {
      if (typeof guard.previous === 'number') {
        filter[guard.field] = guard.previous;
      } else {
        filter.$or = [
          { [guard.field]: { $exists: false } },
          { [guard.field]: null },
        ];
      }
    }
    try {
      const result = await Task.updateOne(filter, update).exec();
      const matched =
        (typeof result === 'object' && result !== null && 'matchedCount' in result
          ? Number((result as { matchedCount: number }).matchedCount)
          : typeof result === 'object' && result !== null && 'n' in result
          ? Number((result as { n: number }).n)
          : 0) || 0;
      if (guard && matched === 0) {
        console.warn(
          'Не удалось сохранить telegram_message_id из-за изменения состояния задачи',
          { taskId },
        );
      }
    } catch (error) {
      console.error(
        'Не удалось сохранить обновлённые данные Telegram для задачи',
        error,
      );
    }
  }

  private async sendTaskAttachments(
    chat: string | number,
    attachments: NormalizedAttachment[],
    topicId?: number,
    replyTo?: number,
    cache?: Map<string, LocalPhotoInfo | null>,
  ): Promise<number[]> {
    if (!attachments.length) return [];
    const sentMessageIds: number[] = [];
    const photoOptionsBase = () => {
      const options: SendPhotoOptions = {};
      if (typeof topicId === 'number') {
        options.message_thread_id = topicId;
      }
      if (replyTo) {
        options.reply_parameters = {
          message_id: replyTo,
          allow_sending_without_reply: true,
        };
      }
      return options;
    };
    const messageOptionsBase = () => {
      const options: SendMessageOptions = {
        parse_mode: 'MarkdownV2',
        link_preview_options: { is_disabled: true },
      };
      if (typeof topicId === 'number') {
        options.message_thread_id = topicId;
      }
      if (replyTo) {
        options.reply_parameters = {
          message_id: replyTo,
          allow_sending_without_reply: true,
        };
      }
      return options;
    };
    const documentOptionsBase = () => {
      const options: SendDocumentOptions = {};
      if (typeof topicId === 'number') {
        options.message_thread_id = topicId;
      }
      if (replyTo) {
        options.reply_parameters = {
          message_id: replyTo,
          allow_sending_without_reply: true,
        };
      }
      return options;
    };

    const localPhotoInfoCache = cache ?? new Map<string, LocalPhotoInfo | null>();
    const resolvePhotoInput = (url: string) =>
      this.resolvePhotoInputWithCache(url, localPhotoInfoCache);

    const pendingImages: { url: string; caption?: string }[] = [];
    type SendMediaGroupOptions = (Parameters<
      typeof bot.telegram.sendMediaGroup
    >[2] & {
      reply_parameters?: {
        message_id: number;
        allow_sending_without_reply?: boolean;
      };
    });
    const mediaGroupOptionsBase = () => {
      const options: SendMediaGroupOptions = {};
      if (typeof topicId === 'number') {
        options.message_thread_id = topicId;
      }
      if (replyTo) {
        options.reply_parameters = {
          message_id: replyTo,
          allow_sending_without_reply: true,
        };
      }
      return options;
    };
    const sendSingleImage = async (current: { url: string; caption?: string }) => {
      const caption = current.caption;
      const sendPhotoAttempt = async () => {
        const options = photoOptionsBase();
        if (caption) {
          options.caption = escapeMarkdownV2(caption);
          options.parse_mode = 'MarkdownV2';
        }
        const media = await resolvePhotoInput(current.url);
        const response = await bot.telegram.sendPhoto(chat, media, options);
        if (response?.message_id) {
          sentMessageIds.push(response.message_id);
        }
      };
      try {
        await sendPhotoAttempt();
        return;
      } catch (error) {
        const photoErrorCode = this.extractPhotoErrorCode(error);
        if (!photoErrorCode) {
          throw error;
        }
        console.warn(
          `Telegram не смог обработать изображение (код: ${photoErrorCode}), отправляем как документ`,
          current.url,
          error,
        );
        const documentOptions = documentOptionsBase();
        if (caption) {
          documentOptions.caption = escapeMarkdownV2(caption);
          documentOptions.parse_mode = 'MarkdownV2';
        }
        const fallback = await resolvePhotoInput(current.url);
        const response = await bot.telegram.sendDocument(
          chat,
          fallback,
          documentOptions,
        );
        if (response?.message_id) {
          sentMessageIds.push(response.message_id);
        }
      }
    };
    const flushImages = async () => {
      while (pendingImages.length) {
        if (pendingImages.length === 1) {
          const current = pendingImages.shift();
          if (!current) continue;
          await sendSingleImage(current);
          continue;
        }
        const batch = pendingImages.splice(0, 10);
        const mediaGroup = await Promise.all(
          batch.map(async (item) => {
            const descriptor: Parameters<
              typeof bot.telegram.sendMediaGroup
            >[1][number] = {
              type: 'photo',
              media: await resolvePhotoInput(item.url),
            };
            if (item.caption) {
              descriptor.caption = escapeMarkdownV2(item.caption);
              descriptor.parse_mode = 'MarkdownV2';
            }
            return descriptor;
          }),
        );
        try {
          const response = await bot.telegram.sendMediaGroup(
            chat,
            mediaGroup,
            mediaGroupOptionsBase(),
          );
          if (!Array.isArray(response) || response.length === 0) {
            throw new Error('Telegram не вернул сообщения для медиа-группы');
          }
          response.forEach((message) => {
            if (message?.message_id) {
              sentMessageIds.push(message.message_id);
            }
          });
        } catch (error) {
          console.warn(
            'Не удалось отправить изображения медиа-группой, отправляем по одному',
            error,
          );
          for (const item of batch) {
            await sendSingleImage(item);
          }
        }
      }
    };

    for (const attachment of attachments) {
      if (attachment.kind === 'image') {
        pendingImages.push({ url: attachment.url, caption: attachment.caption });
        continue;
      }
      await flushImages();
      if (attachment.kind === 'unsupported-image') {
        try {
          const response = await bot.telegram.sendDocument(
            chat,
            await resolvePhotoInput(attachment.url),
            (() => {
              const options = documentOptionsBase();
              if (attachment.caption) {
                options.caption = escapeMarkdownV2(attachment.caption);
                options.parse_mode = 'MarkdownV2';
              }
              return options;
            })(),
          );
          if (response?.message_id) {
            sentMessageIds.push(response.message_id);
          }
        } catch (error) {
          console.error(
            'Не удалось отправить неподдерживаемое изображение как документ',
            attachment.mimeType ?? 'unknown',
            attachment.name ?? attachment.url,
            error,
          );
        }
        continue;
      }
      if (attachment.kind === 'youtube') {
        const label = attachment.title ? attachment.title : 'YouTube';
        const text = `▶️ [${escapeMarkdownV2(label)}](${escapeMarkdownV2(
          attachment.url,
        )})`;
        const response = await bot.telegram.sendMessage(
          chat,
          text,
          messageOptionsBase(),
        );
        if (response?.message_id) {
          sentMessageIds.push(response.message_id);
        }
      }
    }
    await flushImages();
    return sentMessageIds;
  }

  private async syncAttachmentMessages(
    chat: string | number,
    previous: NormalizedAttachment[],
    next: NormalizedAttachment[],
    messageIds: number[],
    topicId?: number,
    replyTo?: number,
    cacheOverride?: Map<string, LocalPhotoInfo | null>,
    previewMessageIds?: number[],
  ): Promise<number[] | null> {
    const normalizedMessageIds = messageIds.filter((value): value is number =>
      typeof value === 'number' && Number.isFinite(value),
    );
    const previewIdSet = new Set(
      (previewMessageIds ?? []).filter(
        (value): value is number => typeof value === 'number' && Number.isFinite(value),
      ),
    );
    const previewOnlyIds = normalizedMessageIds.filter((id) => previewIdSet.has(id));
    const nonPreviewIds = normalizedMessageIds.filter((id) => !previewIdSet.has(id));
    if (!next.length) {
      if (previewOnlyIds.length) {
        await this.deleteAttachmentMessages(chat, previewOnlyIds);
      }
      return [];
    }
    const cache = cacheOverride ?? new Map<string, LocalPhotoInfo | null>();
    const result: number[] = [];
    if (!nonPreviewIds.length) {
      const extra = await this.sendTaskAttachments(
        chat,
        next,
        topicId,
        replyTo,
        cache,
      );
      result.push(...extra);
      return result;
    }
    const limit = Math.min(next.length, nonPreviewIds.length);

    for (let index = 0; index < limit; index += 1) {
      const attachment = next[index];
      const messageId = nonPreviewIds[index];
      if (!Number.isFinite(messageId)) {
        return null;
      }
      const previousAttachment = previous[index];
      if (previousAttachment && previousAttachment.kind !== attachment.kind) {
        return null;
      }
      if (attachment.kind === 'image') {
        const previousUrl =
          previousAttachment && previousAttachment.kind === 'image'
            ? previousAttachment.url
            : null;
        const previousCaption =
          previousAttachment && previousAttachment.kind === 'image'
            ? previousAttachment.caption ?? ''
            : '';
        const nextCaption = attachment.caption ?? '';
        const urlChanged = previousUrl !== attachment.url;
        const captionChanged = previousCaption !== nextCaption;
        if (!urlChanged && !captionChanged) {
          result.push(messageId);
          continue;
        }
        try {
          const media: Parameters<typeof bot.telegram.editMessageMedia>[3] = {
            type: 'photo',
            media: await this.resolvePhotoInputWithCache(attachment.url, cache),
          };
          if (attachment.caption) {
            media.caption = escapeMarkdownV2(attachment.caption);
            media.parse_mode = 'MarkdownV2';
          } else {
            media.caption = '';
          }
          await bot.telegram.editMessageMedia(
            chat,
            messageId,
            undefined,
            media,
          );
          result.push(messageId);
        } catch (error) {
          if (this.isMessageNotModifiedError(error)) {
            result.push(messageId);
            continue;
          }
          console.error('Не удалось обновить изображение вложения', error);
          return null;
        }
        continue;
      }
      if (attachment.kind === 'unsupported-image') {
        const previousEntry =
          previousAttachment && previousAttachment.kind === 'unsupported-image'
            ? previousAttachment
            : null;
        const previousUrl = previousEntry ? previousEntry.url : null;
        const previousCaption = previousEntry?.caption ?? '';
        const previousMime = previousEntry?.mimeType ?? '';
        const previousName = previousEntry?.name ?? '';
        const nextCaption = attachment.caption ?? '';
        const nextMime = attachment.mimeType ?? '';
        const nextName = attachment.name ?? '';
        const urlChanged = previousUrl !== attachment.url;
        const captionChanged = previousCaption !== nextCaption;
        const metaChanged = previousMime !== nextMime || previousName !== nextName;
        if (!urlChanged && !captionChanged && !metaChanged) {
          result.push(messageId);
          continue;
        }
        try {
          const media: Parameters<typeof bot.telegram.editMessageMedia>[3] = {
            type: 'document',
            media: await this.resolvePhotoInputWithCache(attachment.url, cache),
          };
          if (attachment.caption) {
            media.caption = escapeMarkdownV2(attachment.caption);
            media.parse_mode = 'MarkdownV2';
          } else {
            media.caption = '';
          }
          await bot.telegram.editMessageMedia(chat, messageId, undefined, media);
          result.push(messageId);
        } catch (error) {
          if (this.isMessageNotModifiedError(error)) {
            result.push(messageId);
            continue;
          }
          console.error(
            'Не удалось обновить вложение неподдерживаемого изображения',
            attachment.mimeType ?? 'unknown',
            attachment.name ?? attachment.url,
            error,
          );
          return null;
        }
        continue;
      }
      if (attachment.kind === 'youtube') {
        const previousTitle =
          previousAttachment && previousAttachment.kind === 'youtube'
            ? previousAttachment.title ?? ''
            : '';
        const previousUrl =
          previousAttachment && previousAttachment.kind === 'youtube'
            ? previousAttachment.url
            : '';
        if (
          previousUrl === attachment.url &&
          previousTitle === (attachment.title ?? '')
        ) {
          result.push(messageId);
          continue;
        }
        try {
          const label = attachment.title ? attachment.title : 'YouTube';
          const text = `▶️ [${escapeMarkdownV2(label)}](${escapeMarkdownV2(
            attachment.url,
          )})`;
          await bot.telegram.editMessageText(chat, messageId, undefined, text, {
            parse_mode: 'MarkdownV2',
            link_preview_options: { is_disabled: true },
          });
          result.push(messageId);
        } catch (error) {
          console.error('Не удалось обновить ссылку на YouTube', error);
          return null;
        }
        continue;
      }
      return null;
    }

    if (next.length < nonPreviewIds.length) {
      const redundant = nonPreviewIds.slice(next.length);
      await this.deleteAttachmentMessages(chat, redundant);
    }

    if (next.length > nonPreviewIds.length) {
      const extra = await this.sendTaskAttachments(
        chat,
        next.slice(nonPreviewIds.length),
        topicId,
        replyTo,
        cache,
      );
      result.push(...extra);
    }

    return result;
  }

  private async refreshStatusHistoryMessage(taskId: string) {
    if (!groupChatId) return;
    try {
      const payload = await getTaskHistoryMessage(taskId);
      if (!payload) return;
      const { messageId, text, topicId } = payload;
      if (messageId) {
        await bot.telegram.editMessageText(
          groupChatId,
          messageId,
          undefined,
          text,
          {
            parse_mode: 'MarkdownV2',
            link_preview_options: { is_disabled: true },
          },
        );
        return;
      }
      const options: SendMessageOptions = {
        parse_mode: 'MarkdownV2',
        link_preview_options: { is_disabled: true },
      };
      if (typeof topicId === 'number') {
        options.message_thread_id = topicId;
      }
      const statusMessage = await bot.telegram.sendMessage(
        groupChatId,
        text,
        options,
      );
      if (statusMessage?.message_id) {
        await updateTaskHistoryMessageId(taskId, statusMessage.message_id);
      }
    } catch (error) {
      console.error(
        `Не удалось обновить историю статусов задачи ${taskId}`,
        error,
      );
    }
  }

  private async updateTaskStatusSummary(
    task: TaskWithMeta & Record<string, unknown>,
  ): Promise<void> {
    if (!groupChatId) return;
    const summary = await buildHistorySummaryLog(task);
    if (!summary) return;
    const messageId =
      typeof task.telegram_summary_message_id === 'number'
        ? task.telegram_summary_message_id
        : typeof task.telegram_status_message_id === 'number'
        ? task.telegram_status_message_id
        : undefined;
    const summaryMessageId =
      typeof task.telegram_summary_message_id === 'number'
        ? task.telegram_summary_message_id
        : undefined;
    const topicId = this.normalizeTopicId(task.telegram_topic_id);
    const replyTo =
      typeof task.telegram_message_id === 'number'
        ? task.telegram_message_id
        : undefined;
    const editOptions: EditMessageTextOptions = {
      link_preview_options: { is_disabled: true },
    };
    const sendOptions: SendMessageOptions = {
      link_preview_options: { is_disabled: true },
    };
    if (typeof topicId === 'number') {
      sendOptions.message_thread_id = topicId;
    }
    if (typeof replyTo === 'number') {
      sendOptions.reply_parameters = { message_id: replyTo };
    }
    if (messageId) {
      try {
        await bot.telegram.editMessageText(
          groupChatId,
          messageId,
          undefined,
          summary,
          editOptions,
        );
        return;
        } catch (error) {
          console.error('Не удалось обновить краткое сообщение задачи', error);
          if (summaryMessageId) {
            await this.deleteTaskMessageSafely(
              groupChatId,
              summaryMessageId,
              topicId,
              topicId,
            );
          }
        }
      }
    try {
      const statusMessage = await bot.telegram.sendMessage(
        groupChatId,
        summary,
        sendOptions,
      );
      if (statusMessage?.message_id && task._id) {
        const docId =
          typeof task._id === 'object' && task._id !== null && 'toString' in task._id
            ? (task._id as { toString(): string }).toString()
            : String(task._id);
        if (docId) {
          const applied = await updateTaskSummaryMessageId(
            docId,
            statusMessage.message_id,
            typeof summaryMessageId === 'number' ? summaryMessageId : null,
          );
          if (!applied) {
            console.warn(
              'Значение telegram_summary_message_id было изменено раньше обновления',
              { taskId: docId },
            );
          } else {
            task.telegram_summary_message_id = statusMessage.message_id;
          }
        }
      }
    } catch (error) {
      console.error('Не удалось отправить краткое сообщение задачи', error);
    }
  }

  private async syncTelegramTaskMessage(
    taskId: string,
    previous: (TaskWithMeta & Record<string, unknown>) | null,
  ) {
    if (!groupChatId) return;
    const fresh = await Task.findById(taskId);
    if (!fresh) return;
    const plain = (typeof fresh.toObject === 'function'
      ? (fresh.toObject() as unknown)
      : (fresh as unknown)) as TaskWithMeta & Record<string, unknown>;
    const previousPlain = previous;

    const recipients = this.collectNotificationTargets(
      plain,
      typeof plain.created_by === 'number' ? plain.created_by : undefined,
    );
    const usersRaw = await getUsersMap(Array.from(recipients));
    const users = Object.fromEntries(
      Object.entries(usersRaw).map(([key, value]) => {
        const name = value.name ?? value.username ?? '';
        const username = value.username ?? '';
        return [Number(key), { name, username }];
      }),
    );

    const formatted = formatTask(plain as unknown as SharedTask, users);
    const message = formatted.text;
    const nextAttachments = this.collectSendableAttachments(
      plain,
      formatted.inlineImages,
    );
    const keyboard = taskStatusKeyboard(taskId);
    const topicId = this.normalizeTopicId(plain.telegram_topic_id);

    const previousMessageId =
      typeof previousPlain?.telegram_message_id === 'number'
        ? previousPlain.telegram_message_id
        : undefined;
    const previousTopicId = this.normalizeTopicId(
      previousPlain?.telegram_topic_id,
    );
    let currentMessageId =
      typeof plain.telegram_message_id === 'number'
        ? plain.telegram_message_id
        : undefined;
    const updatesToSet: Record<string, unknown> = {};
    const updatesToUnset: Record<string, unknown> = {};
    let messageIdGuard: number | null | undefined;
    let canPersistNewMessageId =
      typeof previousMessageId === 'number' ? false : true;
    let previousMessageDeletedBeforeResend = false;

    const normalizeMessageIds = (value: unknown): number[] =>
      Array.isArray(value)
        ? value
            .map((item) =>
              typeof item === 'number' && Number.isFinite(item) ? item : null,
            )
            .filter((item): item is number => item !== null)
        : [];

    const previousAttachmentMessageIds = normalizeMessageIds(
      previousPlain?.telegram_attachments_message_ids,
    );
    const previousPreviewMessageIds = normalizeMessageIds(
      previousPlain?.telegram_preview_message_ids,
    );
    const currentPreviewMessageIds = normalizeMessageIds(
      plain.telegram_preview_message_ids,
    );

    let messageResult: TaskMessageSendResult | null = null;
    if (currentMessageId) {
      const editResult = await this.editTaskMessageWithPreview(
        groupChatId,
        currentMessageId,
        message,
        nextAttachments,
        keyboard,
      );
      if (editResult.success) {
        messageResult = {
          messageId: currentMessageId,
          usedPreview: editResult.usedPreview,
          cache: editResult.cache,
          previewSourceUrls: editResult.previewSourceUrls,
          previewMessageIds:
            editResult.usedPreview && currentPreviewMessageIds.length
              ? currentPreviewMessageIds
              : undefined,
        };
      } else {
        console.error('Не удалось обновить сообщение задачи, отправляем заново');
        try {
          const previewIdsToDelete = new Set([
            ...previousPreviewMessageIds,
            ...currentPreviewMessageIds,
          ]);
          if (previousMessageId) {
            previousMessageDeletedBeforeResend = await this.deleteTaskMessageSafely(
              groupChatId,
              previousMessageId,
              previousTopicId,
              topicId,
            );
            previewIdsToDelete.delete(previousMessageId);
          }
          if (previewIdsToDelete.size) {
            await this.deleteAttachmentMessages(
              groupChatId,
              Array.from(previewIdsToDelete),
            );
          }
          const sendResult = await this.sendTaskMessageWithPreview(
            groupChatId,
            message,
            nextAttachments,
            keyboard,
            topicId,
          );
          currentMessageId = sendResult.messageId;
          if (
            sendResult.messageId &&
            previousMessageId &&
            sendResult.messageId !== previousMessageId &&
            !previousMessageDeletedBeforeResend
          ) {
            const deleted = await this.deleteTaskMessageSafely(
              groupChatId,
              previousMessageId,
              previousTopicId,
              topicId,
            );
            if (deleted) {
              canPersistNewMessageId = true;
            }
          } else if (previousMessageDeletedBeforeResend) {
            canPersistNewMessageId = true;
          }
          messageResult = sendResult;
        } catch (sendError) {
          console.error('Не удалось отправить новое сообщение задачи', sendError);
          return;
        }
      }
    } else {
      try {
        const previewIdsToDelete = new Set([
          ...previousPreviewMessageIds,
          ...currentPreviewMessageIds,
        ]);
        if (previousMessageId) {
          previousMessageDeletedBeforeResend = await this.deleteTaskMessageSafely(
            groupChatId,
            previousMessageId,
            previousTopicId,
            topicId,
          );
          previewIdsToDelete.delete(previousMessageId);
        }
        if (previewIdsToDelete.size) {
          await this.deleteAttachmentMessages(
            groupChatId,
            Array.from(previewIdsToDelete),
          );
        }
        const sendResult = await this.sendTaskMessageWithPreview(
          groupChatId,
          message,
          nextAttachments,
          keyboard,
          topicId,
        );
        currentMessageId = sendResult.messageId;
        if (
          sendResult.messageId &&
          previousMessageId &&
          sendResult.messageId !== previousMessageId &&
          !previousMessageDeletedBeforeResend
        ) {
          const deleted = await this.deleteTaskMessageSafely(
            groupChatId,
            previousMessageId,
            previousTopicId,
            topicId,
          );
          if (deleted) {
            canPersistNewMessageId = true;
          }
        } else if (previousMessageDeletedBeforeResend) {
          canPersistNewMessageId = true;
        }
        messageResult = sendResult;
      } catch (error) {
        console.error('Не удалось отправить сообщение задачи', error);
        return;
      }
    }

    if (!messageResult) {
      return;
    }

    const previousFormatted = previousPlain
      ? formatTask(previousPlain as unknown as SharedTask, users)
      : null;

    const previousAttachments = previousPlain
      ? this.collectSendableAttachments(previousPlain, previousFormatted?.inlineImages)
      : { previewImage: null, extras: [], collageCandidates: [] };
    const previousExtrasRaw = previousAttachments.extras;
    const nextExtrasRaw = nextAttachments.extras;
    const previousPreviewUrls =
      previousAttachments.collageCandidates.length >= 2
        ? previousAttachments.collageCandidates.map((item) => item.url)
        : previousAttachments.previewImage?.url
          ? [previousAttachments.previewImage.url]
          : [];
    const previousPreviewSet = new Set(
      previousPreviewUrls.filter((value): value is string => !!value),
    );
    const previousExtras = previousPreviewSet.size
      ? previousExtrasRaw.filter(
          (attachment) =>
            attachment.kind !== 'image' || !previousPreviewSet.has(attachment.url),
        )
      : previousExtrasRaw;
    const nextPreviewUrls = messageResult.usedPreview
      ? messageResult.previewSourceUrls && messageResult.previewSourceUrls.length
        ? messageResult.previewSourceUrls
        : nextAttachments.previewImage?.url
          ? [nextAttachments.previewImage.url]
          : []
      : [];
    const nextPreviewSet = new Set(
      nextPreviewUrls.filter((value): value is string => !!value),
    );
    const nextExtras = nextPreviewSet.size
      ? nextExtrasRaw.filter(
          (attachment) =>
            attachment.kind !== 'image' || !nextPreviewSet.has(attachment.url),
        )
      : nextExtrasRaw;
    let previewMessageIds = [...previousPreviewMessageIds];
    const previewIdsToRemove: number[] = [];

    const messageIdChanged = previousMessageId !== currentMessageId;
    const attachmentsChanged = !this.areNormalizedAttachmentsEqual(
      previousExtras,
      nextExtras,
    );

    let attachmentMessageIds = [...previousAttachmentMessageIds];
    let attachmentsListChanged = false;
    let previewListChanged = false;

    if (messageResult.previewMessageIds && messageResult.previewMessageIds.length) {
      const normalizedPreview = normalizeMessageIds(
        messageResult.previewMessageIds,
      );
      if (!this.areMessageIdListsEqual(normalizedPreview, previewMessageIds)) {
        previewListChanged = true;
      }
      previewMessageIds = normalizedPreview;
    } else if (!messageResult.usedPreview && previewMessageIds.length) {
      const removable = previewMessageIds.filter(
        (id) =>
          typeof currentMessageId === 'number' ? id !== currentMessageId : true,
      );
      if (removable.length) {
        previewIdsToRemove.push(...removable);
      }
      previewMessageIds =
        typeof currentMessageId === 'number' &&
        previousPreviewMessageIds.includes(currentMessageId)
          ? [currentMessageId]
          : [];
      previewListChanged = true;
    }

    if (previewIdsToRemove.length) {
      await this.deleteAttachmentMessages(groupChatId, previewIdsToRemove);
    }

    if (messageIdChanged && attachmentMessageIds.length) {
      await this.deleteAttachmentMessages(groupChatId, attachmentMessageIds);
      attachmentMessageIds = [];
      attachmentsListChanged = true;
    }

    if (!nextExtras.length) {
      if (attachmentMessageIds.length) {
        await this.deleteAttachmentMessages(groupChatId, attachmentMessageIds);
        attachmentMessageIds = [];
        attachmentsListChanged = true;
      }
      if (previewMessageIds.length) {
        const removablePreviewIds = previewMessageIds.filter(
          (id) => id !== currentMessageId,
        );
        if (removablePreviewIds.length) {
          await this.deleteAttachmentMessages(groupChatId, removablePreviewIds);
          previewMessageIds = previewMessageIds.filter(
            (id) => id === currentMessageId,
          );
          previewListChanged = true;
        }
      }
    } else if (currentMessageId) {
      if (!attachmentMessageIds.length) {
        try {
          const ids = await this.sendTaskAttachments(
            groupChatId,
            nextExtras,
            topicId,
            currentMessageId,
            messageResult.cache,
          );
          if (ids.length) {
            attachmentMessageIds = ids;
            attachmentsListChanged = true;
          }
        } catch (error) {
          console.error('Не удалось отправить вложения задачи', error);
        }
      } else if (attachmentsChanged && !messageIdChanged) {
        try {
          const previewIdsForSync = Array.from(
            new Set([...previousPreviewMessageIds, ...previewMessageIds]),
          );
          const synced = await this.syncAttachmentMessages(
            groupChatId,
            previousExtras,
            nextExtras,
            attachmentMessageIds,
            topicId,
            currentMessageId,
            messageResult.cache,
            previewIdsForSync,
          );
          if (synced === null) {
            throw new Error('sync failed');
          }
          if (!this.areMessageIdListsEqual(synced, attachmentMessageIds)) {
            attachmentsListChanged = true;
          }
          attachmentMessageIds = synced;
        } catch (error) {
          console.error('Не удалось обновить вложения задачи', error);
          try {
            await this.deleteAttachmentMessages(groupChatId, attachmentMessageIds);
          } catch (cleanupError) {
            console.error(
              'Не удалось удалить старые вложения задачи',
              cleanupError,
            );
          }
          attachmentMessageIds = [];
          try {
            const ids = await this.sendTaskAttachments(
              groupChatId,
              nextExtras,
              topicId,
              currentMessageId,
              messageResult.cache,
            );
            attachmentMessageIds = ids;
          } catch (sendError) {
            console.error('Не удалось отправить вложения задачи', sendError);
          }
          attachmentsListChanged = true;
        }
      }
    }

    await this.updateTaskStatusSummary(plain);

    const attachmentsShouldPersist =
      attachmentsListChanged ||
      !this.areMessageIdListsEqual(
        attachmentMessageIds,
        previousAttachmentMessageIds,
      );

    if (attachmentsShouldPersist && (!messageIdChanged || canPersistNewMessageId)) {
      updatesToSet.telegram_attachments_message_ids = attachmentMessageIds;
    }

    const previewShouldPersist =
      previewListChanged ||
      !this.areMessageIdListsEqual(previewMessageIds, previousPreviewMessageIds);

    if (previewShouldPersist && (!messageIdChanged || canPersistNewMessageId)) {
      if (previewMessageIds.length) {
        updatesToSet.telegram_preview_message_ids = previewMessageIds;
      } else {
        updatesToUnset.telegram_preview_message_ids = '';
      }
    }

    if (messageIdChanged && currentMessageId && canPersistNewMessageId) {
      updatesToSet.telegram_message_id = currentMessageId;
      messageIdGuard =
        typeof previousMessageId === 'number' ? previousMessageId : null;
    } else if (messageIdChanged && !canPersistNewMessageId) {
      console.warn(
        'Пропускаем сохранение нового telegram_message_id из-за ошибки удаления',
        { taskId },
      );
    }

    await this.updateTaskTelegramFields(
      taskId,
      updatesToSet,
      updatesToUnset,
      typeof messageIdGuard === 'undefined'
        ? undefined
        : { field: 'telegram_message_id', previous: messageIdGuard },
    );
  }

  private isMessageNotModifiedError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const record = error as Record<string, unknown>;
    const rawResponse = record.response;
    const response =
      rawResponse && typeof rawResponse === 'object'
        ? (rawResponse as { error_code?: number; description?: unknown })
        : null;
    const descriptionRaw =
      (response?.description ??
        (typeof record.description === 'string' ? record.description : null)) ??
      null;
    const description =
      typeof descriptionRaw === 'string' ? descriptionRaw.toLowerCase() : '';
    return (
      response?.error_code === 400 &&
      description.includes('message is not modified')
    );
  }

  private async notifyTaskCreated(task: TaskDocument, creatorId: number) {
    const docId =
      typeof task._id === 'object' && task._id !== null && 'toString' in task._id
        ? (task._id as { toString(): string }).toString()
        : String(task._id ?? '');
    const plain =
      typeof task.toObject === 'function'
        ? (task.toObject() as TaskDocument & Record<string, unknown>)
        : task;
    if (!docId) return;
    const recipients = this.collectNotificationTargets(plain, creatorId);
    const usersRaw = await getUsersMap(Array.from(recipients));
    const users = Object.fromEntries(
      Object.entries(usersRaw).map(([key, value]) => {
        const name = value.name ?? value.username ?? '';
        const username = value.username ?? '';
        return [Number(key), { name, username }];
      }),
    );
    const mainKeyboard = taskStatusKeyboard(docId);
    const formatted = formatTask(plain as unknown as SharedTask, users);
    const message = formatted.text;
    let groupMessageId: number | undefined;
    let statusMessageId: number | undefined;
    let messageLink: string | null = null;

    let attachmentMessageIds: number[] = [];
    let previewMessageIds: number[] = [];
    if (groupChatId) {
      try {
        const topicId =
          typeof plain.telegram_topic_id === 'number'
            ? plain.telegram_topic_id
            : undefined;
        const media = this.collectSendableAttachments(
          plain,
          formatted.inlineImages,
        );
        const sendResult = await this.sendTaskMessageWithPreview(
          groupChatId,
          message,
          media,
          mainKeyboard,
          topicId,
        );
        groupMessageId = sendResult.messageId;
        previewMessageIds = sendResult.previewMessageIds ?? [];
        messageLink = buildChatMessageLink(groupChatId, groupMessageId);
        const previewUrls = sendResult.usedPreview
          ? sendResult.previewSourceUrls && sendResult.previewSourceUrls.length
            ? sendResult.previewSourceUrls
            : media.previewImage?.url
              ? [media.previewImage.url]
              : []
          : [];
        const previewSet = new Set(
          previewUrls.filter((value): value is string => !!value),
        );
        const extras = previewSet.size
          ? media.extras.filter(
              (attachment) =>
                attachment.kind !== 'image' || !previewSet.has(attachment.url),
            )
          : media.extras;
        if (groupMessageId && extras.length) {
          try {
            attachmentMessageIds = await this.sendTaskAttachments(
              groupChatId,
              extras,
              topicId,
              groupMessageId,
              sendResult.cache,
            );
          } catch (error) {
            console.error('Не удалось отправить вложения задачи', error);
          }
        }
        const statusText = await buildActionMessage(
          plain,
          'создана',
          new Date(
            (plain as { createdAt?: string | Date }).createdAt ?? Date.now(),
          ),
          creatorId,
        );
        const statusOptions: SendMessageOptions = {
          link_preview_options: { is_disabled: true },
        };
        if (typeof topicId === 'number') {
          statusOptions.message_thread_id = topicId;
        }
        if (groupMessageId) {
          statusOptions.reply_parameters = { message_id: groupMessageId };
        }
        const statusMessage = await bot.telegram.sendMessage(
          groupChatId,
          statusText,
          statusOptions,
        );
        statusMessageId = statusMessage?.message_id;
      } catch (error) {
        console.error('Не удалось отправить уведомление в группу', error);
      }
    }

    const assignees = this.collectAssignees(plain);
    assignees.delete(creatorId);
    if (messageLink && assignees.size) {
      const identifier = getTaskIdentifier(plain);
      const dmText = `Вам назначена задача <a href="${messageLink}">${identifier}</a>`;
      const dmOptions: SendMessageOptions = {
        ...taskStatusKeyboard(docId),
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      };
      await Promise.allSettled(
        Array.from(assignees).map((userId) =>
          bot.telegram
            .sendMessage(userId, dmText, dmOptions)
            .catch((error) => {
              console.error(
                `Не удалось отправить уведомление пользователю ${userId}`,
                error,
              );
            }),
        ),
      );
    }

    const updatePayload: Record<string, unknown> = {};
    if (groupMessageId) {
      updatePayload.telegram_message_id = groupMessageId;
    }
    if (statusMessageId) {
      updatePayload.telegram_history_message_id = statusMessageId;
    }
    if (attachmentMessageIds && attachmentMessageIds.length) {
      updatePayload.telegram_attachments_message_ids = attachmentMessageIds;
    }
    if (previewMessageIds.length) {
      updatePayload.telegram_preview_message_ids = previewMessageIds;
    }
    if (Object.keys(updatePayload).length) {
      try {
        await Task.findByIdAndUpdate(docId, updatePayload).exec();
      } catch (error) {
        console.error('Не удалось сохранить идентификаторы сообщений задачи', error);
      }
    }
  }

  list = async (req: RequestWithUser, res: Response) => {
    const { page, limit, ...filters } = req.query;
    let tasks: TaskEx[];
    let total = 0;
    if (['admin', 'manager'].includes(req.user!.role || '')) {
      const res = await this.service.get(
        filters,
        page ? Number(page) : undefined,
        limit ? Number(limit) : undefined,
      );
      tasks = res.tasks as unknown as TaskEx[];
      total = res.total;
    } else {
      tasks = (await this.service.mentioned(
        String(req.user!.id),
      )) as unknown as TaskEx[];
      total = tasks.length;
    }
    const ids = new Set<number>();
    tasks.forEach((t) => {
      (t.assignees || []).forEach((id: number) => ids.add(id));
      (t.controllers || []).forEach((id: number) => ids.add(id));
      if (t.created_by) ids.add(t.created_by);
      (t.history || []).forEach((h) => ids.add(h.changed_by));
    });
    const users = await getUsersMap(Array.from(ids));
    sendCached(req, res, { tasks, users, total });
  };

  detail = async (req: Request, res: Response) => {
    const task = (await this.service.getById(
      req.params.id,
    )) as unknown as TaskEx | null;
    if (!task) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Задача не найдена',
        status: 404,
        detail: 'Not Found',
      });
      return;
    }
    const ids = new Set<number>();
    (task.assignees || []).forEach((id: number) => ids.add(id));
    (task.controllers || []).forEach((id: number) => ids.add(id));
    if (task.created_by) ids.add(task.created_by);
    (task.history || []).forEach((h) => ids.add(h.changed_by));
    const users = await getUsersMap(Array.from(ids));
    res.json({ task, users });
  };

  create = [
    handleValidation,
    async (req: RequestWithUser, res: Response) => {
      const task = await this.service.create(
        req.body as Partial<TaskDocument>,
        req.user!.id as number,
      );
      await writeLog(
        `Создана задача ${task._id} пользователем ${req.user!.id}/${req.user!.username}`,
      );
      res.status(201).json(task);
      void this.notifyTaskCreated(task, req.user!.id as number).catch((error) => {
        console.error('Не удалось отправить уведомление о создании задачи', error);
      });
    },
  ];

  update = [
    handleValidation,
    async (req: RequestWithUser, res: Response) => {
      const previousRaw = await Task.findById(req.params.id);
      const previousTask = previousRaw
        ? ((typeof previousRaw.toObject === 'function'
            ? (previousRaw.toObject() as unknown)
            : (previousRaw as unknown)) as TaskWithMeta & Record<string, unknown>)
        : null;
      const task = await this.service.update(
        req.params.id,
        req.body as Partial<TaskDocument>,
        req.user!.id as number,
      );
      if (!task) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Задача не найдена',
          status: 404,
          detail: 'Not Found',
        });
        return;
      }
      await writeLog(
        `Обновлена задача ${req.params.id} пользователем ${req.user!.id}/${req.user!.username}`,
      );
      res.json(task);
      const docId =
        typeof task._id === 'object' && task._id !== null && 'toString' in task._id
          ? (task._id as { toString(): string }).toString()
          : String(task._id ?? '');
      if (docId) {
        void (async () => {
          await this.refreshStatusHistoryMessage(docId);
          try {
            await this.syncTelegramTaskMessage(docId, previousTask);
          } catch (error) {
            console.error('Не удалось синхронизировать сообщение задачи', error);
          }
        })();
      }
    },
  ];

  addTime = [
    handleValidation,
    async (req: RequestWithUser, res: Response) => {
      const { minutes } = req.body as { minutes: number };
      const task = await this.service.addTime(req.params.id, minutes);
      if (!task) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Задача не найдена',
          status: 404,
          detail: 'Not Found',
        });
        return;
      }
      await writeLog(
        `Время по задаче ${req.params.id} +${minutes} пользователем ${req.user!.id}/${req.user!.username}`,
      );
      res.json(task);
    },
  ];

  bulk = [
    handleValidation,
    async (req: RequestWithUser, res: Response) => {
      const { ids, status } = req.body as {
        ids: string[];
        status: TaskDocument['status'];
      };
      await this.service.bulk(ids, { status });
      await writeLog(
        `Массовое изменение статусов пользователем ${req.user!.id}/${req.user!.username}`,
      );
      res.json({ status: 'ok' });
    },
  ];

  mentioned = async (req: RequestWithUser, res: Response) => {
    const tasks = await this.service.mentioned(String(req.user!.id));
    res.json(tasks);
  };

  summary = async (req: Request, res: Response) => {
    res.json(await this.service.summary(req.query));
  };

  remove = async (req: RequestWithUser, res: Response) => {
    const task = await this.service.remove(req.params.id);
    if (!task) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Задача не найдена',
        status: 404,
        detail: 'Not Found',
      });
      return;
    }
    await writeLog(
      `Удалена задача ${req.params.id} пользователем ${req.user!.id}/${req.user!.username}`,
    );
    res.sendStatus(204);
  };
}
