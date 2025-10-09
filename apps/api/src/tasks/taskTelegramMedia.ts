// Назначение: вспомогательные операции Telegram для вложений задач и заявок
// Основные модули: sharp, telegraf, utils/mdEscape, db/model
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, stat, writeFile } from 'node:fs/promises';
import type { ReadStream } from 'node:fs';
import sharp from 'sharp';
import type { Context, Telegraf } from 'telegraf';
import escapeMarkdownV2 from '../utils/mdEscape';
import {
  File,
  type Attachment,
  type FileDocument,
  type TaskDocument,
} from '../db/model';
import { uploadsDir } from '../config/storage';
import type { InlineImage } from '../utils/formatTask';

type LocalPhotoInfo = {
  absolutePath: string;
  filename: string;
  contentType?: string;
  size?: number;
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

type TaskMessageSendResult = {
  messageId: number | undefined;
  usedPreview: boolean;
  cache: Map<string, LocalPhotoInfo | null>;
  previewSourceUrls?: string[];
  previewMessageIds?: number[];
  consumedAttachmentUrls?: string[];
};

type TaskTelegramMediaOptions = {
  baseAppUrl: string;
};

const FILE_ID_REGEXP = /\/api\/v1\/files\/([0-9a-f]{24})(?=$|[/?#])/i;
const HTTP_URL_REGEXP = /^https?:\/\//i;
const YOUTUBE_URL_REGEXP =
  /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\//i;
const SUPPORTED_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

const uploadsAbsoluteDir = path.resolve(uploadsDir);

const createAttachmentsBaseUrl = (baseAppUrl: string): string | null => {
  try {
    const normalized = new URL(baseAppUrl);
    return normalized.origin.replace(/\/+$/, '');
  } catch {
    return baseAppUrl.replace(/\/+$/, '') || null;
  }
};

const toAbsoluteAttachmentUrl = (
  url: string,
  baseUrl: string | null,
): string | null => {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (HTTP_URL_REGEXP.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  if (!baseUrl) {
    return null;
  }
  const normalizedPath = trimmed.startsWith('/')
    ? trimmed.slice(1)
    : trimmed;
  return `${baseUrl}/${normalizedPath}`;
};

const resolveBaseHost = (value: string): string | null => {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
};

export class TaskTelegramMedia {
  private readonly attachmentsBaseUrl: string | null;

  private readonly baseAppHost: string | null;

  private readonly botApiPhotoErrorPatterns: RegExp[] = [
    /\bIMAGE_PROCESS_FAILED\b/,
    /\bPHOTO_[A-Z_]+\b/,
    /\bFILE_TOO_BIG\b/,
    /\bFILE_UPLOAD_[A-Z_]+\b/,
    /\bFILE_SIZE_[A-Z_]+\b/,
  ];

  constructor(
    private readonly bot: Telegraf<Context>,
    private readonly options: TaskTelegramMediaOptions,
  ) {
    this.attachmentsBaseUrl = createAttachmentsBaseUrl(options.baseAppUrl);
    this.baseAppHost = resolveBaseHost(options.baseAppUrl);
  }

  collectSendableAttachments(
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
        const absolute = toAbsoluteAttachmentUrl(
          url,
          this.attachmentsBaseUrl,
        );
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
    return {
      previewImage,
      extras,
      collageCandidates,
    };
  }

  async sendTaskMessageWithPreview(
    chat: string | number,
    message: string,
    media: TaskMedia,
    keyboardMarkup:
      | Parameters<typeof this.bot.telegram.editMessageReplyMarkup>[3]
      | undefined,
    topicId?: number,
  ): Promise<TaskMessageSendResult> {
    const cache = new Map<string, LocalPhotoInfo | null>();
    const preview = media.previewImage;
    const previewUrl = preview?.url;
    const albumCandidates: NormalizedImage[] = [];
    const seenAlbumUrls = new Set<string>();
    if (preview && previewUrl && !seenAlbumUrls.has(previewUrl)) {
      albumCandidates.push(preview);
      seenAlbumUrls.add(previewUrl);
    }
    media.extras.forEach((attachment) => {
      if (attachment.kind !== 'image') return;
      if (!attachment.url || seenAlbumUrls.has(attachment.url)) return;
      albumCandidates.push(attachment);
      seenAlbumUrls.add(attachment.url);
    });

    const baseOptions = () => ({
      ...(typeof topicId === 'number' ? { message_thread_id: topicId } : {}),
      ...(keyboardMarkup ? { reply_markup: keyboardMarkup } : {}),
    });

    if (albumCandidates.length > 1 && message.length <= 1024) {
      try {
        type SendMediaGroupOptions = Parameters<
          typeof this.bot.telegram.sendMediaGroup
        >[2] & {
          reply_parameters?: {
            message_id: number;
            allow_sending_without_reply?: boolean;
          };
        };
        const mediaGroupOptions: SendMediaGroupOptions = {};
        if (typeof topicId === 'number') {
          mediaGroupOptions.message_thread_id = topicId;
        }
        const selected = albumCandidates.slice(0, 10);
        const consumedUrls = selected.map((item) => item.url);
        const mediaGroup = await Promise.all(
          selected.map(async (item, index) => {
            const descriptor: Parameters<
              typeof this.bot.telegram.sendMediaGroup
            >[1][number] = {
              type: 'photo',
              media: await this.resolvePhotoInputWithCache(item.url, cache),
            };
            const caption = index === 0 ? message : item.caption;
            if (caption) {
              descriptor.caption =
                index === 0 ? caption : escapeMarkdownV2(caption);
              descriptor.parse_mode = 'MarkdownV2';
            }
            return descriptor;
          }),
        );
        const response = await this.bot.telegram.sendMediaGroup(
          chat,
          mediaGroup,
          mediaGroupOptions,
        );
        if (!Array.isArray(response) || response.length === 0) {
          throw new Error('Telegram не вернул сообщения для альбома задачи');
        }
        const previewMessageIds = response
          .map((message) =>
            typeof message?.message_id === 'number'
              ? message.message_id
              : undefined,
          )
          .filter((value): value is number => typeof value === 'number');
        const messageId = previewMessageIds[0];
        if (!messageId) {
          throw new Error('Отсутствует идентификатор сообщения альбома задачи');
        }
        if (keyboardMarkup) {
          try {
            await this.bot.telegram.editMessageReplyMarkup(
              chat,
              messageId,
              undefined,
              keyboardMarkup,
            );
          } catch (error) {
            if (!this.isMessageNotModifiedError(error)) {
              console.error(
                'Не удалось добавить клавиатуру к альбому задачи',
                error,
              );
            }
          }
        }
        return {
          messageId,
          usedPreview: true,
          cache,
          previewSourceUrls: consumedUrls,
          previewMessageIds,
          consumedAttachmentUrls: consumedUrls,
        };
      } catch (error) {
        console.error('Не удалось отправить альбом задачи', error);
      }
    }

    if (previewUrl && message.length <= 1024) {
      try {
        const photoOptions = {
          ...baseOptions(),
          caption: message,
          parse_mode: 'MarkdownV2' as const,
        };
        const photo = await this.resolvePhotoInputWithCache(previewUrl, cache);
        const response = await this.bot.telegram.sendPhoto(
          chat,
          photo,
          photoOptions,
        );
        return {
          messageId: response?.message_id,
          usedPreview: true,
          cache,
          previewSourceUrls: [previewUrl],
          previewMessageIds: response?.message_id
            ? [response.message_id]
            : undefined,
          consumedAttachmentUrls: [previewUrl],
        };
      } catch (error) {
        console.error(
          'Не удалось отправить задачу с изображением превью',
          error,
        );
      }
    }

    const options: Parameters<typeof this.bot.telegram.sendMessage>[2] = {
      parse_mode: 'MarkdownV2',
      link_preview_options: { is_disabled: true },
      ...(keyboardMarkup ? { reply_markup: keyboardMarkup } : {}),
    };
    if (typeof topicId === 'number') {
      options.message_thread_id = topicId;
    }
    const response = await this.bot.telegram.sendMessage(chat, message, options);
    return {
      messageId: response?.message_id,
      usedPreview: false,
      cache,
      previewSourceUrls: undefined,
      previewMessageIds: undefined,
      consumedAttachmentUrls: [],
    };
  }

  async sendTaskAttachments(
    chat: string | number,
    attachments: NormalizedAttachment[],
    topicId?: number,
    replyTo?: number,
    cache?: Map<string, LocalPhotoInfo | null>,
  ): Promise<number[]> {
    if (!attachments.length) return [];
    const sentMessageIds: number[] = [];
    const photoOptionsBase = () => {
      const options: Parameters<typeof this.bot.telegram.sendPhoto>[2] = {};
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
      const options: Parameters<typeof this.bot.telegram.sendDocument>[2] = {
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
    const messageOptionsBase = () => {
      const options: Parameters<typeof this.bot.telegram.sendMessage>[2] = {
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

    const localPhotoInfoCache = cache ?? new Map<string, LocalPhotoInfo | null>();
    const resolvePhotoInput = (url: string) =>
      this.resolvePhotoInputWithCache(url, localPhotoInfoCache);

    const pendingImages: { url: string; caption?: string }[] = [];
    type SendMediaGroupOptions = Parameters<
      typeof this.bot.telegram.sendMediaGroup
    >[2] & {
      reply_parameters?: {
        message_id: number;
        allow_sending_without_reply?: boolean;
      };
    };
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
        const response = await this.bot.telegram.sendPhoto(chat, media, options);
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
        const response = await this.bot.telegram.sendDocument(
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
              typeof this.bot.telegram.sendMediaGroup
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
          const response = await this.bot.telegram.sendMediaGroup(
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
          const response = await this.bot.telegram.sendDocument(
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
        const response = await this.bot.telegram.sendMessage(
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

  async deleteAttachmentMessages(
    chat: string | number,
    messageIds: number[],
  ): Promise<void> {
    const normalized = messageIds.filter((value) =>
      typeof value === 'number' && Number.isFinite(value),
    );
    for (const messageId of normalized) {
      try {
        await this.bot.telegram.deleteMessage(chat, messageId);
      } catch (error) {
        if (!this.isMessageMissingOnDeleteError(error)) {
          console.error(
            `Не удалось удалить сообщение вложения ${messageId} задачи`,
            error,
          );
        }
      }
    }
  }

  private normalizeInlineImages(inline: InlineImage[] | undefined) {
    if (!inline?.length) return [] as NormalizedImage[];
    const result: NormalizedImage[] = [];
    inline.forEach((image) => {
      if (!image?.url) return;
      const absolute = toAbsoluteAttachmentUrl(
        image.url,
        this.attachmentsBaseUrl,
      );
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

  private extractLocalFileId(url: string): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url, this.options.baseAppUrl);
      if (this.baseAppHost && parsed.host && parsed.host !== this.baseAppHost) {
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

  private async resolvePhotoInputWithCache(
    url: string,
    cache: Map<string, LocalPhotoInfo | null>,
  ): Promise<ReadStream | string> {
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
      return descriptor as unknown as ReadStream;
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
    if (cause instanceof Error && typeof cause.message === 'string') {
      candidates.add(cause.message);
    }
    if (!candidates.size) {
      return null;
    }
    const joined = Array.from(candidates).join(' ');
    const match = this.botApiPhotoErrorPatterns.find((pattern) =>
      pattern.test(joined),
    );
    return match ? match.source : null;
  }

  private isMessageNotModifiedError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const candidate = error as Record<string, unknown> & {
      response?: { error_code?: number; description?: unknown };
      description?: unknown;
    };
    const descriptionSource =
      typeof candidate.response?.description === 'string'
        ? candidate.response.description
        : typeof candidate.description === 'string'
          ? candidate.description
          : '';
    const description = descriptionSource.toLowerCase();
    return (
      candidate.response?.error_code === 400 &&
      description.includes('message is not modified')
    );
  }

  private isMessageMissingOnDeleteError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const candidate = error as Record<string, unknown> & {
      response?: { error_code?: number; description?: unknown };
      description?: unknown;
      error_code?: unknown;
    };
    const errorCode =
      candidate.response?.error_code ??
      (typeof candidate.error_code === 'number' ? candidate.error_code : null);
    if (errorCode !== 400) {
      return false;
    }
    const descriptionSource =
      typeof candidate.response?.description === 'string'
        ? candidate.response.description
        : typeof candidate.description === 'string'
          ? candidate.description
          : '';
    return descriptionSource.toLowerCase().includes(
      'message to delete not found',
    );
  }
}

export type {
  TaskMedia,
  TaskMessageSendResult,
  NormalizedAttachment,
  LocalPhotoInfo,
};
