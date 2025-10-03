// Контроллер задач с использованием TasksService
// Основные модули: express-validator, services, wgLogEngine, taskHistory.service, utils/mdEscape
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
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
  updateTaskStatusMessageId,
} from './taskHistory.service';
import escapeMarkdownV2 from '../utils/mdEscape';
import {
  buildActionMessage,
  buildHistorySummaryLog,
  getTaskIdentifier,
} from './taskMessages';

type TaskEx = SharedTask & {
  controllers?: number[];
  created_by?: number;
  history?: { changed_by: number }[];
  telegram_attachments_message_ids?: number[];
};

type TaskWithMeta = TaskDocument & {
  telegram_attachments_message_ids?: number[];
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
    }
  | { kind: 'youtube'; url: string; title?: string };

type NormalizedImage = Extract<NormalizedAttachment, { kind: 'image' }>;

type TaskMedia = {
  previewImage: NormalizedImage | null;
  extras: NormalizedAttachment[];
};

type SendMessageOptions = NonNullable<
  Parameters<typeof bot.telegram.sendMessage>[2]
>;
type EditMessageTextOptions = NonNullable<
  Parameters<typeof bot.telegram.editMessageText>[4]
>;
type SendPhotoOptions = NonNullable<
  Parameters<typeof bot.telegram.sendPhoto>[2]
>;
type SendMediaGroupOptions = NonNullable<
  Parameters<typeof bot.telegram.sendMediaGroup>[2]
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
      cache.set(url, info);
    }
    const info = cache.get(url);
    if (!info) {
      return url;
    }
    try {
      const descriptor = {
        source: createReadStream(info.absolutePath),
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
    const registerImage = (image: NormalizedImage) => {
      previewPool.push(image);
      extras.push(image);
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
          extras.push({ kind: 'youtube', url, title });
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
        if (mimeType && SUPPORTED_PHOTO_MIME_TYPES.has(mimeType)) {
          registerImage({ kind: 'image', url: absolute });
          return;
        }
        const name =
          typeof attachment.name === 'string' && attachment.name.trim()
            ? attachment.name.trim()
            : undefined;
        extras.push({
          kind: 'unsupported-image',
          url: absolute,
          mimeType,
          name,
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
    };
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

  private isImageProcessFailedError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const { response, description, message } = error as {
      response?: { description?: unknown };
      description?: unknown;
      message?: unknown;
    };
    const candidates = [
      typeof response?.description === 'string' ? response.description : null,
      typeof description === 'string' ? description : null,
      typeof message === 'string' ? message : null,
    ];
    return candidates.some(
      (candidate) => candidate !== null && candidate.includes('IMAGE_PROCESS_FAILED'),
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
      return { absolutePath: target, filename, contentType };
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
    const flushImages = async () => {
      const sendSingleImage = async (
        original: { url: string; caption?: string },
        resolved?: PhotoInput,
      ) => {
        const caption = original.caption;
        const sendPhotoAttempt = async (media: PhotoInput) => {
          const options = photoOptionsBase();
          if (caption) {
            options.caption = escapeMarkdownV2(caption);
            options.parse_mode = 'MarkdownV2';
          }
          const response = await bot.telegram.sendPhoto(chat, media, options);
          if (response?.message_id) {
            sentMessageIds.push(response.message_id);
          }
        };
        try {
          await sendPhotoAttempt(resolved ?? (await resolvePhotoInput(original.url)));
          return;
        } catch (error) {
          if (!this.isImageProcessFailedError(error)) {
            throw error;
          }
          console.warn(
            'Telegram не смог обработать изображение, отправляем как документ',
            original.url,
            error,
          );
        }
        const documentOptions = documentOptionsBase();
        if (caption) {
          documentOptions.caption = escapeMarkdownV2(caption);
          documentOptions.parse_mode = 'MarkdownV2';
        }
        const fallback = await resolvePhotoInput(original.url);
        const response = await bot.telegram.sendDocument(
          chat,
          fallback,
          documentOptions,
        );
        if (response?.message_id) {
          sentMessageIds.push(response.message_id);
        }
      };

      while (pendingImages.length) {
        const chunk = pendingImages.splice(0, 10);
        const prepared = await Promise.all(
          chunk.map(async (item) => ({
            original: item,
            media: await resolvePhotoInput(item.url),
          })),
        );
        if (prepared.length === 1) {
          const [single] = prepared;
          await sendSingleImage(single.original, single.media);
          continue;
        }
        const media = prepared.map((item) => ({
          type: 'photo' as const,
          media: item.media,
          ...(item.original.caption
            ? {
                caption: escapeMarkdownV2(item.original.caption),
                parse_mode: 'MarkdownV2' as const,
              }
            : {}),
        }));
        try {
          const response = await bot.telegram.sendMediaGroup(
            chat,
            media,
            mediaGroupOptionsBase(),
          );
          if (Array.isArray(response)) {
            response.forEach((entry) => {
              if (entry?.message_id) {
                sentMessageIds.push(entry.message_id);
              }
            });
          }
        } catch (error) {
          if (!this.isImageProcessFailedError(error)) {
            throw error;
          }
          console.warn(
            'Telegram не смог обработать медиагруппу, отправляем изображения по одному',
            error,
          );
          for (const item of chunk) {
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
  ): Promise<number[] | null> {
    if (!messageIds.length) {
      return [];
    }
    const cache = new Map<string, LocalPhotoInfo | null>();
    const result: number[] = [];
    const limit = Math.min(next.length, messageIds.length);

    for (let index = 0; index < limit; index += 1) {
      const attachment = next[index];
      const messageId = messageIds[index];
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

    if (next.length < messageIds.length) {
      const redundant = messageIds.slice(next.length);
      await this.deleteAttachmentMessages(chat, redundant);
    }

    if (next.length > messageIds.length) {
      const extra = await this.sendTaskAttachments(
        chat,
        next.slice(messageIds.length),
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
        await updateTaskStatusMessageId(taskId, statusMessage.message_id);
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
      typeof task.telegram_status_message_id === 'number'
        ? task.telegram_status_message_id
        : undefined;
    const topicId =
      typeof task.telegram_topic_id === 'number'
        ? task.telegram_topic_id
        : undefined;
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
      }
    }
    try {
      const statusMessage = await bot.telegram.sendMessage(
        groupChatId,
        summary,
        sendOptions,
      );
      if (statusMessage?.message_id && task._id) {
        await Task.findByIdAndUpdate(task._id, {
          telegram_status_message_id: statusMessage.message_id,
        }).exec();
        task.telegram_status_message_id = statusMessage.message_id;
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
    const previewOptions = this.createPreviewOptions(nextAttachments.previewImage);
    const editOptions: EditMessageTextOptions = {
      parse_mode: 'MarkdownV2',
      link_preview_options: previewOptions,
      reply_markup: keyboard.reply_markup,
    };
    const topicId =
      typeof plain.telegram_topic_id === 'number'
        ? plain.telegram_topic_id
        : undefined;
    const sendOptionsBase: SendMessageOptions = {
      parse_mode: 'MarkdownV2',
      link_preview_options: previewOptions,
      reply_markup: keyboard.reply_markup,
    };
    if (typeof topicId === 'number') {
      sendOptionsBase.message_thread_id = topicId;
    }
    const sendOptions = sendOptionsBase;

    const previousMessageId =
      typeof previousPlain?.telegram_message_id === 'number'
        ? previousPlain.telegram_message_id
        : undefined;
    let currentMessageId =
      typeof plain.telegram_message_id === 'number'
        ? plain.telegram_message_id
        : undefined;
    const updates: Record<string, unknown> = {};

    if (currentMessageId) {
      try {
        await bot.telegram.editMessageText(
          groupChatId,
          currentMessageId,
          undefined,
          message,
          editOptions,
        );
      } catch (error) {
        if (this.isMessageNotModifiedError(error)) {
          console.warn(
            'Сообщение задачи не изменилось, пропускаем повторную отправку',
          );
        } else {
          console.error('Не удалось обновить сообщение задачи', error);
          try {
            const sentMessage = await bot.telegram.sendMessage(
              groupChatId,
              message,
              sendOptions,
            );
            if (sentMessage?.message_id) {
              currentMessageId = sentMessage.message_id;
              updates.telegram_message_id = sentMessage.message_id;
            }
          } catch (sendError) {
            console.error('Не удалось отправить новое сообщение задачи', sendError);
            return;
          }
        }
      }
    } else {
      try {
        const sentMessage = await bot.telegram.sendMessage(
          groupChatId,
          message,
          sendOptions,
        );
        if (sentMessage?.message_id) {
          currentMessageId = sentMessage.message_id;
          updates.telegram_message_id = sentMessage.message_id;
        }
      } catch (error) {
        console.error('Не удалось отправить сообщение задачи', error);
        return;
      }
    }

    const previousFormatted = previousPlain
      ? formatTask(previousPlain as unknown as SharedTask, users)
      : null;

    const previousAttachments = previousPlain
      ? this.collectSendableAttachments(previousPlain, previousFormatted?.inlineImages)
      : { previewImage: null, extras: [] };
    const previousExtras = previousAttachments.extras;
    const nextExtras = nextAttachments.extras;
    const previousAttachmentMessageIds = Array.isArray(
      previousPlain?.telegram_attachments_message_ids,
    )
      ? previousPlain!.telegram_attachments_message_ids.filter((value) =>
          typeof value === 'number' && Number.isFinite(value),
        )
      : [];

    const messageIdChanged = previousMessageId !== currentMessageId;
    const attachmentsChanged = !this.areNormalizedAttachmentsEqual(
      previousExtras,
      nextExtras,
    );

    let attachmentMessageIds = [...previousAttachmentMessageIds];
    let attachmentsListChanged = false;

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
    } else if (currentMessageId) {
      if (!attachmentMessageIds.length) {
        try {
          const ids = await this.sendTaskAttachments(
            groupChatId,
            nextExtras,
            topicId,
            currentMessageId,
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
          const synced = await this.syncAttachmentMessages(
            groupChatId,
            previousExtras,
            nextExtras,
            attachmentMessageIds,
            topicId,
            currentMessageId,
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

    if (
      attachmentsListChanged ||
      !this.areMessageIdListsEqual(
        attachmentMessageIds,
        previousAttachmentMessageIds,
      )
    ) {
      updates.telegram_attachments_message_ids = attachmentMessageIds;
    }

    if (Object.keys(updates).length) {
      try {
        await Task.findByIdAndUpdate(taskId, updates).exec();
      } catch (error) {
        console.error(
          'Не удалось сохранить обновлённые данные Telegram для задачи',
          error,
        );
      }
    }
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
        const groupOptions: SendMessageOptions = {
          parse_mode: 'MarkdownV2',
          link_preview_options: this.createPreviewOptions(media.previewImage),
          ...mainKeyboard,
        };
        if (typeof topicId === 'number') {
          groupOptions.message_thread_id = topicId;
        }
        const groupMessage = await bot.telegram.sendMessage(
          groupChatId,
          message,
          groupOptions,
        );
        groupMessageId = groupMessage?.message_id;
        messageLink = buildChatMessageLink(groupChatId, groupMessageId);
        if (media.extras.length) {
          try {
            attachmentMessageIds = await this.sendTaskAttachments(
              groupChatId,
              media.extras,
              topicId,
              groupMessageId,
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
      updatePayload.telegram_status_message_id = statusMessageId;
    }
    if (attachmentMessageIds && attachmentMessageIds.length) {
      updatePayload.telegram_attachments_message_ids = attachmentMessageIds;
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
