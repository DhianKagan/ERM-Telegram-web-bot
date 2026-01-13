// Контроллер задач с использованием TasksService
// Основные модули: express-validator, services, wgLogEngine, utils/mdEscape
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, stat, writeFile } from 'node:fs/promises';
import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { handleValidation } from '../utils/validate';
import { TOKENS } from '../di/tokens';
import type TasksService from './tasks.service';
import { writeLog } from '../services/service';
import { getUsersMap } from '../db/queries';
import type { RequestWithUser } from '../types/request';
import { Task, User, type TaskDocument, type Attachment } from '../db/model';
import { getFileRecord, setTelegramFileId } from '../services/fileService';
import { FleetVehicle } from '../db/models/fleet';
import { CollectionItem } from '../db/models/CollectionItem';
import { sendProblem } from '../utils/problem';
import { sendCached } from '../utils/sendCached';
import { type Task as SharedTask } from 'shared';
import {
  bot,
  buildDirectTaskKeyboard,
  buildDirectTaskMessage,
  type TaskUserProfile,
} from '../bot/bot';
import { buildTaskAppLink } from './taskLinks';
import { extractFileIdFromUrl } from '../utils/attachments';
import {
  getChatId,
  chatId as staticChatId,
  appUrl as baseAppUrl,
} from '../config';
import taskStatusKeyboard, {
  taskStatusInlineMarkup,
  type TaskStatusKeyboardExtras,
} from '../utils/taskButtons';
import formatTask, {
  type InlineImage,
  type FormatTaskSection,
} from '../utils/formatTask';
import buildChatMessageLink from '../utils/messageLink';
import delay from '../utils/delay';
import { uploadsDir } from '../config/storage';
import escapeMarkdownV2 from '../utils/mdEscape';
import sharp from 'sharp';
import {
  resolveTaskTypeTopicId,
  resolveTaskTypePhotosTarget,
} from '../services/taskTypeSettings';
import {
  ACCESS_ADMIN,
  ACCESS_MANAGER,
  ACCESS_TASK_DELETE,
  hasAccess as hasAccessMask,
} from '../utils/accessMask';
import { ensureCommentHtml, syncCommentMessage } from '../tasks/taskComments';
import { cleanupUploadedFiles } from '../utils/requestUploads';
import { normalizeTaskFilters } from './filterUtils';
import {
  finalizePendingUploads as finalizeTaskUploads,
  purgeTemporaryUploads as dropPendingUploads,
} from './uploadFinalizer';
import { syncTaskPoints } from '../utils/taskPoints';
import {
  prepareIncomingPoints,
  TaskPointsValidationError,
} from '../utils/taskPointsInput';
import ReportGeneratorService from '../services/reportGenerator';

type TelegramMessageCleanupMeta = {
  chat_id: string | number;
  message_id: number;
  topic_id?: number;
  attempted_topic_id?: number;
  new_message_id?: number;
  reason: 'delete-failed' | 'topic-mismatch';
  attempted_at: string;
};

type TaskEx = SharedTask & {
  kind?: 'task' | 'request';
  controllers?: number[];
  created_by?: number;
  history?: { changed_by: number }[];
  telegram_attachments_message_ids?: number[];
  telegram_preview_message_ids?: number[];
  telegram_message_cleanup?: TelegramMessageCleanupMeta;
};

type TaskWithMeta = TaskDocument & {
  telegram_attachments_message_ids?: number[];
  telegram_preview_message_ids?: number[];
  telegram_message_cleanup?: TelegramMessageCleanupMeta;
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

const resolveGroupChatId = (): string | undefined =>
  typeof getChatId === 'function' ? getChatId() : staticChatId;

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
const ALBUM_MESSAGE_DELAY_MS = 100;

const REQUEST_TYPE_NAME = 'Заявка';
const TERMINAL_TASK_STATUSES: ReadonlySet<TaskDocument['status']> = new Set([
  'Выполнена',
  'Отменена',
]);

const isTerminalStatus = (
  status: TaskDocument['status'] | string | undefined,
): status is TaskDocument['status'] =>
  typeof status === 'string' && TERMINAL_TASK_STATUSES.has(status as never);

const isUserStatusTransitionAllowed = (
  currentStatus: TaskDocument['status'] | undefined,
  nextStatus: TaskDocument['status'] | undefined,
): boolean => {
  if (!nextStatus) return false;
  if (isTerminalStatus(currentStatus)) return false;
  if (!currentStatus || currentStatus === 'Новая') {
    return nextStatus === 'В работе' || nextStatus === 'Выполнена';
  }
  if (currentStatus === 'В работе') {
    return nextStatus === 'Выполнена' || nextStatus === 'В работе';
  }
  return false;
};

const cleanupRequestUploads = async (req: Request): Promise<void> => {
  await cleanupUploadedFiles(req).catch(() => undefined);
  await dropPendingUploads(req).catch(() => undefined);
};

const detectTaskKind = (
  task:
    | (Partial<TaskDocument> & { kind?: unknown; task_type?: unknown })
    | Record<string, unknown>
    | null
    | undefined,
): 'task' | 'request' => {
  if (!task || typeof task !== 'object') {
    return 'task';
  }
  const source = task as Record<string, unknown>;
  const rawKind = typeof source.kind === 'string' ? source.kind.trim() : '';
  if (rawKind === 'request') return 'request';
  const typeValue =
    typeof source.task_type === 'string' ? source.task_type.trim() : '';
  return typeValue === REQUEST_TYPE_NAME ? 'request' : 'task';
};

const resolveTaskLabel = (kind: 'task' | 'request') =>
  kind === 'request' ? 'Заявка' : 'Задача';

const hasAdminAccess = (role: unknown, access: unknown): boolean => {
  const roleName = typeof role === 'string' ? role : '';
  if (roleName === 'admin') return true;
  const mask = typeof access === 'number' ? access : 0;
  return (mask & ACCESS_ADMIN) === ACCESS_ADMIN;
};

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
  const normalizedPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
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

type SendMessageOptions = NonNullable<
  Parameters<typeof bot.telegram.sendMessage>[2]
>;

type TaskMessageSendResult = {
  messageId: number | undefined;
  usedPreview: boolean;
  cache: Map<string, LocalPhotoInfo | null>;
  previewSourceUrls?: string[];
  previewMessageIds?: number[];
  consumedAttachmentUrls?: string[];
};
type SendPhotoOptions = NonNullable<
  Parameters<typeof bot.telegram.sendPhoto>[2]
>;
type SendDocumentOptions = NonNullable<
  Parameters<typeof bot.telegram.sendDocument>[2]
>;
type PhotoInput = Parameters<typeof bot.telegram.sendPhoto>[1];
type DirectMessageEntry = { user_id: number; message_id: number };

const SUPPORTED_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
const TELEGRAM_MESSAGE_LIMIT = 4096;

const hasOddTrailingBackslash = (value: string): boolean => {
  const match = value.match(/\\+$/);
  if (!match) {
    return false;
  }
  return match[0].length % 2 === 1;
};

const adjustBreakIndex = (text: string, index: number): number => {
  let candidate = Math.min(Math.max(index, 1), text.length);
  while (candidate > 0) {
    const prefix = text.slice(0, candidate);
    if (!hasOddTrailingBackslash(prefix)) {
      break;
    }
    candidate -= 1;
  }
  return candidate;
};

const findBreakIndex = (text: string, limit: number): number => {
  const windowEnd = Math.min(limit + 1, text.length);
  const window = text.slice(0, windowEnd);
  const doubleNewlineIndex = window.lastIndexOf('\n\n');
  if (doubleNewlineIndex >= 0) {
    return doubleNewlineIndex + 2;
  }
  const newlineIndex = window.lastIndexOf('\n');
  if (newlineIndex >= 0) {
    return newlineIndex + 1;
  }
  const spaceIndex = window.lastIndexOf(' ');
  if (spaceIndex >= 0) {
    return spaceIndex + 1;
  }
  return Math.min(limit, text.length);
};

const splitMessageForTelegramLimit = (
  text: string,
  limit: number,
): string[] => {
  const normalized = typeof text === 'string' ? text : '';
  if (!normalized) {
    return [];
  }
  if (normalized.length <= limit) {
    return [normalized];
  }
  const parts: string[] = [];
  let remaining = normalized;
  while (remaining.length > limit) {
    let breakIndex = findBreakIndex(remaining, limit);
    breakIndex = adjustBreakIndex(remaining, breakIndex);
    if (breakIndex <= 0 || breakIndex >= remaining.length) {
      breakIndex = Math.min(limit, remaining.length);
    }
    let chunk = remaining.slice(0, breakIndex);
    if (!chunk.trim()) {
      chunk = remaining.slice(0, Math.min(limit, remaining.length));
      breakIndex = chunk.length;
    }
    if (!chunk) {
      break;
    }
    parts.push(chunk);
    remaining = remaining.slice(breakIndex).replace(/^[\n\r]+/, '');
  }
  if (remaining.length) {
    parts.push(remaining);
  }
  return parts;
};

@injectable()
export default class TasksController {
  constructor(
    @inject(TOKENS.TasksService) private service: TasksService,
    @inject(TOKENS.ReportGeneratorService)
    private reportGenerator: ReportGeneratorService,
  ) {}

  private collectNotificationTargets(
    task: Partial<TaskDocument>,
    creatorId?: number,
  ) {
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
      if (!value) {
        return;
      }
      if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const isBotFlag =
          record.is_bot === true ||
          (typeof record.is_bot === 'string' &&
            record.is_bot.trim().toLowerCase() === 'true');
        if (isBotFlag) {
          return;
        }
        if ('telegram_id' in record) {
          add(record.telegram_id);
        }
        if ('user_id' in record) {
          add(record.user_id);
        }
        if ('id' in record) {
          add(record.id);
        }
        return;
      }
      const num = Number(value);
      if (!Number.isNaN(num) && Number.isFinite(num) && num !== 0) {
        recipients.add(num);
      }
    };
    add(task.assigned_user_id);
    if (task && typeof task === 'object') {
      const record = task as Record<string, unknown>;
      if (record.assigned_user && typeof record.assigned_user === 'object') {
        const assignedRecord = record.assigned_user as Record<string, unknown>;
        if ('telegram_id' in assignedRecord) {
          add(assignedRecord.telegram_id);
        } else if ('id' in assignedRecord) {
          add(assignedRecord.id);
        }
      }
    }
    if (Array.isArray(task.assignees)) task.assignees.forEach(add);
    return recipients;
  }

  private sendPointsProblem(
    error: TaskPointsValidationError,
    req: Request,
    res: Response,
  ): void {
    const title = 'Маршрут недопустим';
    if (error.code === 'points_limit_exceeded') {
      sendProblem(req, res, {
        type: 'about:blank',
        title,
        status: 422,
        detail: error.message,
      });
      return;
    }

    if (error.code === 'invalid_segment') {
      const details =
        (error.details as
          | { reason?: string; index?: number; maxSegmentM?: number }
          | undefined) ?? {};
      let detail = 'Не удалось проверить сегменты маршрута';
      if (details.reason === 'too_few_points') {
        detail = 'Укажите минимум две точки с координатами';
      } else if (details.reason === 'segment_too_long') {
        const index = Number.isFinite(details.index)
          ? Number(details.index) + 1
          : undefined;
        const boundary = Number.isFinite(details.maxSegmentM)
          ? `${details.maxSegmentM} метров`
          : 'допустимый предел';
        if (index !== undefined) {
          detail = `Сегмент между точками ${index} и ${index + 1} превышает ${boundary}`;
        } else {
          detail = `Расстояние между точками превышает ${boundary}`;
        }
      }
      sendProblem(req, res, {
        type: 'about:blank',
        title,
        status: 422,
        detail,
      });
      return;
    }

    sendProblem(req, res, {
      type: 'about:blank',
      title,
      status: 422,
      detail: error.message,
    });
  }

  private async applyPointsPayload(
    payload: Partial<TaskDocument>,
    req: Request,
    res: Response,
  ): Promise<boolean> {
    try {
      const preparedPoints = await prepareIncomingPoints(payload.points);
      if (Array.isArray(payload.points) || preparedPoints.length) {
        payload.points = preparedPoints as TaskDocument['points'];
      }
      return true;
    } catch (error) {
      if (error instanceof TaskPointsValidationError) {
        this.sendPointsProblem(error, req, res);
        return false;
      }
      throw error;
    }
  }

  private normalizeTaskResponse(
    task: TaskEx | TaskDocument | null,
  ): TaskEx | null {
    if (!task) {
      return null;
    }
    const plain =
      typeof (task as { toObject?: () => unknown }).toObject === 'function'
        ? ((task as { toObject: () => unknown }).toObject() as TaskEx)
        : ({ ...(task as Record<string, unknown>) } as TaskEx);

    syncTaskPoints(
      plain as unknown as TaskDocument & {
        points?: unknown;
        startCoordinates?: unknown;
        finishCoordinates?: unknown;
        start_location?: unknown;
        end_location?: unknown;
        google_route_url?: unknown;
      },
    );

    return plain;
  }

  private isBotRecipientError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const response = (
      error as {
        response?: { error_code?: number; description?: unknown };
      }
    ).response;
    if (!response || response.error_code !== 403) {
      return false;
    }
    const description =
      typeof response.description === 'string' ? response.description : '';
    return description
      .toLowerCase()
      .includes("bots can't send messages to bots");
  }

  private isConversationStartRequiredError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const response = (
      error as {
        response?: { error_code?: number; description?: unknown };
      }
    ).response;
    if (!response || response.error_code !== 403) {
      return false;
    }
    const description =
      typeof response.description === 'string' ? response.description : '';
    return description
      .toLowerCase()
      .includes("bot can't initiate conversation with a user");
  }

  private async markUserAsBot(userId: number): Promise<void> {
    if (!Number.isFinite(userId)) {
      return;
    }
    try {
      await User.updateOne(
        { telegram_id: { $eq: userId } },
        { $set: { is_bot: true } },
      ).exec();
    } catch (error) {
      console.error(
        `Не удалось отметить пользователя ${userId} как бота`,
        error,
      );
    }
  }

  private async resolveAdminExecutors(values: unknown[]): Promise<number[]> {
    const normalized = Array.from(
      new Set(
        values
          .map((value) => Number(value))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    );
    if (!normalized.length) {
      return [];
    }
    const admins = await User.find({
      telegram_id: { $in: normalized },
    })
      .select({ telegram_id: 1, role: 1, access: 1 })
      .lean<{ telegram_id: number; role?: string; access?: number }[]>();
    const allowed = admins
      .filter((candidate) => {
        if (!candidate) return false;
        return hasAdminAccess(candidate.role, candidate.access);
      })
      .map((candidate) => Number(candidate.telegram_id))
      .filter((id) => Number.isFinite(id));
    return Array.from(new Set(allowed));
  }

  private async resolveTelegramFileId(url: string): Promise<string | null> {
    if (!url) return null;
    const fileId = extractFileIdFromUrl(url);
    if (!fileId) return null;
    const record = await getFileRecord(fileId);
    const telegramFileId =
      typeof record?.telegramFileId === 'string'
        ? record.telegramFileId.trim()
        : '';
    return telegramFileId || null;
  }

  private async persistTelegramFileId(
    url: string,
    telegramFileId?: string | null,
  ): Promise<void> {
    const fileId = extractFileIdFromUrl(url);
    if (!fileId) return;
    const normalized =
      typeof telegramFileId === 'string' ? telegramFileId.trim() : '';
    if (!normalized) return;
    await setTelegramFileId(fileId, normalized).catch(() => undefined);
  }

  private extractTelegramPhotoId(response: unknown): string | null {
    if (!response || typeof response !== 'object') {
      return null;
    }
    const photos = (response as { photo?: Array<{ file_id?: string }> }).photo;
    if (!Array.isArray(photos) || photos.length === 0) {
      return null;
    }
    const last = photos[photos.length - 1];
    return typeof last?.file_id === 'string' ? last.file_id : null;
  }

  private extractTelegramDocumentId(response: unknown): string | null {
    if (!response || typeof response !== 'object') {
      return null;
    }
    const document = (response as { document?: { file_id?: string } }).document;
    return typeof document?.file_id === 'string' ? document.file_id : null;
  }

  private async resolvePhotoInputWithCache(
    url: string,
    cache: Map<string, LocalPhotoInfo | null>,
  ): Promise<PhotoInput> {
    if (!url) return url;
    const telegramFileId = await this.resolveTelegramFileId(url);
    if (telegramFileId) {
      return telegramFileId;
    }
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
      const caption =
        image.alt && image.alt.trim() ? image.alt.trim() : undefined;
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
          typeof attachment.size === 'number' &&
          Number.isFinite(attachment.size)
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

  private async sendTaskMessageWithPreview(
    chat: string | number,
    message: string,
    _sections: FormatTaskSection[],
    media: TaskMedia,
    keyboard: ReturnType<typeof taskStatusKeyboard>,
    topicId?: number,
    options?: { skipAlbum?: boolean },
  ): Promise<TaskMessageSendResult> {
    const skipAlbum = options?.skipAlbum === true;
    const cache = new Map<string, LocalPhotoInfo | null>();
    const keyboardMarkup = this.extractKeyboardMarkup(keyboard);
    const preview = media.previewImage;
    const previewUrl = preview?.url;
    const albumCandidates: NormalizedImage[] = [];
    const seenAlbumUrls = new Set<string>();
    if (!skipAlbum && preview && previewUrl && !seenAlbumUrls.has(previewUrl)) {
      albumCandidates.push(preview);
      seenAlbumUrls.add(previewUrl);
    }
    media.extras.forEach((attachment) => {
      if (skipAlbum) return;
      if (attachment.kind !== 'image') return;
      if (!attachment.url || seenAlbumUrls.has(attachment.url)) return;
      albumCandidates.push(attachment);
      seenAlbumUrls.add(attachment.url);
    });

    const baseMessageOptions: SendMessageOptions = {
      parse_mode: 'MarkdownV2',
      link_preview_options: { is_disabled: true },
      ...(keyboardMarkup ? { reply_markup: keyboardMarkup } : {}),
    };
    if (typeof topicId === 'number') {
      baseMessageOptions.message_thread_id = topicId;
    }

    const messageChunks = splitMessageForTelegramLimit(
      message,
      TELEGRAM_MESSAGE_LIMIT,
    );
    const [primaryMessage, ...continuationChunks] =
      messageChunks.length > 0 ? messageChunks : [message];

    const response = await bot.telegram.sendMessage(
      chat,
      primaryMessage,
      baseMessageOptions,
    );
    const mainMessageId = response?.message_id;

    const supplementaryMessageIds: number[] = [];
    const sendSupplementaryChunk = async (chunk: string) => {
      if (!chunk || !chunk.trim()) {
        return;
      }
      try {
        const extraOptions: SendMessageOptions = {
          parse_mode: 'MarkdownV2',
          link_preview_options: { is_disabled: true },
        };
        if (typeof topicId === 'number') {
          extraOptions.message_thread_id = topicId;
        }
        if (typeof mainMessageId === 'number') {
          extraOptions.reply_parameters = {
            message_id: mainMessageId,
            allow_sending_without_reply: true,
          };
        }
        const extraMessage = await bot.telegram.sendMessage(
          chat,
          chunk,
          extraOptions,
        );
        if (extraMessage?.message_id) {
          supplementaryMessageIds.push(extraMessage.message_id);
        }
      } catch (error) {
        console.error(
          'Не удалось отправить дополнительный текст задачи',
          error,
        );
      }
    };

    if (continuationChunks.length) {
      for (const chunk of continuationChunks) {
        await sendSupplementaryChunk(chunk);
      }
    }

    const albumMessageIds: number[] = [];
    const consumedAlbumUrls: string[] = [];
    const albumCaption = escapeMarkdownV2('Фото к задаче');

    const mediaReplyParameters =
      typeof mainMessageId === 'number'
        ? {
            reply_parameters: {
              message_id: mainMessageId,
              allow_sending_without_reply: true,
            },
          }
        : {};

    if (!skipAlbum && albumCandidates.length > 1) {
      try {
        type SendMediaGroupOptions = Parameters<
          typeof bot.telegram.sendMediaGroup
        >[2] & {
          reply_parameters?: {
            message_id: number;
            allow_sending_without_reply?: boolean;
          };
        };
        const mediaGroupOptions: SendMediaGroupOptions = {
          ...(typeof topicId === 'number'
            ? { message_thread_id: topicId }
            : {}),
          ...mediaReplyParameters,
        };
        const selected = albumCandidates.slice(0, 10);
        consumedAlbumUrls.push(...selected.map((item) => item.url));
        const mediaGroup = await Promise.all(
          selected.map(async (item, index) => {
            const descriptor: Parameters<
              typeof bot.telegram.sendMediaGroup
            >[1][number] = {
              type: 'photo',
              media: await this.resolvePhotoInputWithCache(item.url, cache),
            };
            const captionValue =
              index === 0 ? albumCaption : (item.caption ?? undefined);
            if (captionValue) {
              descriptor.caption =
                index === 0 ? captionValue : escapeMarkdownV2(captionValue);
              descriptor.parse_mode = 'MarkdownV2';
            }
            return descriptor;
          }),
        );
        const mediaResponse = await bot.telegram.sendMediaGroup(
          chat,
          mediaGroup,
          mediaGroupOptions,
        );
        if (Array.isArray(mediaResponse) && mediaResponse.length) {
          mediaResponse.forEach((entry) => {
            if (typeof entry?.message_id === 'number') {
              albumMessageIds.push(entry.message_id);
            }
          });
          await Promise.all(
            mediaResponse.map((entry, index) => {
              const fileId = this.extractTelegramPhotoId(entry);
              const source = selected[index]?.url;
              if (!fileId || !source) return Promise.resolve();
              return this.persistTelegramFileId(source, fileId);
            }),
          );
        }
      } catch (error) {
        console.error('Не удалось отправить альбом задачи', error);
      }
    } else if (!skipAlbum && previewUrl) {
      try {
        const photoOptions: SendPhotoOptions = {
          ...(typeof topicId === 'number'
            ? { message_thread_id: topicId }
            : {}),
          ...mediaReplyParameters,
          caption: albumCaption,
          parse_mode: 'MarkdownV2',
        };
        const photo = await this.resolvePhotoInputWithCache(previewUrl, cache);
        const photoResponse = await bot.telegram.sendPhoto(
          chat,
          photo,
          photoOptions,
        );
        if (photoResponse?.message_id) {
          albumMessageIds.push(photoResponse.message_id);
        }
        await this.persistTelegramFileId(
          previewUrl,
          this.extractTelegramPhotoId(photoResponse),
        );
        consumedAlbumUrls.push(previewUrl);
      } catch (error) {
        console.error(
          'Не удалось отправить задачу с изображением превью',
          error,
        );
      }
    }

    const previewMessageIds = [...albumMessageIds, ...supplementaryMessageIds];

    return {
      messageId: mainMessageId,
      usedPreview: albumMessageIds.length > 0,
      cache,
      previewSourceUrls: consumedAlbumUrls.length
        ? consumedAlbumUrls
        : undefined,
      previewMessageIds: previewMessageIds.length
        ? previewMessageIds
        : undefined,
      consumedAttachmentUrls: consumedAlbumUrls,
    };
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

  private async updateTaskAlbumKeyboard(
    chatId: string | number,
    messageId: number,
    taskId: string,
    status: SharedTask['status'] | undefined,
    kind: 'task' | 'request',
    albumLink: string | null,
  ): Promise<void> {
    try {
      const editMarkup =
        typeof bot?.telegram?.editMessageReplyMarkup === 'function'
          ? bot.telegram.editMessageReplyMarkup.bind(bot.telegram)
          : null;
      if (!editMarkup) {
        return;
      }
      const extras: TaskStatusKeyboardExtras = {
        ...(albumLink ? { albumLink } : {}),
        showCommentButton: true,
      };
      const markup = taskStatusInlineMarkup(taskId, status, { kind }, extras);
      await editMarkup(chatId, messageId, undefined, markup);
    } catch (error) {
      if (!this.isMessageNotModifiedError(error)) {
        console.error(
          'Не удалось обновить клавиатуру задачи с кнопкой альбома',
          error,
        );
      }
    }
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
    const { response, description, message, cause } = error as {
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
    const messageText =
      typeof message === 'string' ? message.toLowerCase() : '';
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
    const messageText =
      typeof message === 'string' ? message.toLowerCase() : '';
    return (
      descriptionText.includes('message is not a media message') ||
      messageText.includes('message is not a media message')
    );
  }

  private async resolveLocalPhotoInfo(
    url: string,
  ): Promise<LocalPhotoInfo | null> {
    const fileId = this.extractLocalFileId(url);
    if (!fileId) return null;
    try {
      const record = await getFileRecord(fileId);
      if (!record || typeof record.path !== 'string' || !record.path.trim()) {
        return null;
      }
      const normalizedPath = record.path.trim();
      const target = path.resolve(uploadsAbsoluteDir, normalizedPath);
      const relative = path.relative(uploadsAbsoluteDir, target);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
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
          if (this.isMessageMissingOnDeleteError(error)) {
            console.info(
              `Сообщение вложения ${messageId} уже удалено в Telegram`,
            );
            return;
          }
          if (this.isMessageForbiddenToDeleteError(error)) {
            console.warn(
              `Сообщение вложения ${messageId} нельзя удалить в Telegram`,
              error,
            );
            return;
          }
          console.error(
            `Не удалось удалить сообщение вложений ${messageId}`,
            error,
          );
        }
      }),
    );
  }

  private normalizeDirectMessages(value: unknown): DirectMessageEntry[] {
    if (!Array.isArray(value)) return [];
    return (value as unknown[])
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const record = entry as Record<string, unknown>;
        const userId = Number(record.user_id);
        const messageId = Number(record.message_id);
        if (!Number.isFinite(userId) || !Number.isFinite(messageId)) {
          return null;
        }
        return {
          user_id: userId,
          message_id: messageId,
        } satisfies DirectMessageEntry;
      })
      .filter((entry): entry is DirectMessageEntry => entry !== null);
  }

  private toMessageId(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return undefined;
  }

  private normalizeMessageIdList(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    return (value as unknown[])
      .map((item) => this.toMessageId(item))
      .filter((item): item is number => typeof item === 'number');
  }

  private async deleteDirectMessages(
    entries: DirectMessageEntry[],
  ): Promise<void> {
    if (!entries.length) return;
    await Promise.all(
      entries.map(async ({ user_id: userId, message_id: messageId }) => {
        if (!Number.isFinite(userId) || !Number.isFinite(messageId)) return;
        try {
          await bot.telegram.deleteMessage(userId, messageId);
        } catch (error) {
          if (this.isMessageMissingOnDeleteError(error)) {
            console.info(
              `Личное сообщение задачи ${messageId} у пользователя ${userId} уже удалено в Telegram`,
            );
            return;
          }
          if (this.isMessageForbiddenToDeleteError(error)) {
            console.warn(
              `Личное сообщение ${messageId} у пользователя ${userId} нельзя удалить в Telegram`,
              error,
            );
            return;
          }
          console.error(
            `Не удалось удалить личное сообщение задачи ${messageId} у пользователя ${userId}`,
            error,
          );
        }
      }),
    );
  }

  private normalizeChatId(value: unknown): string | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value.toString();
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    }
    return undefined;
  }

  private normalizeTopicId(value: unknown): number | undefined {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }
      const parsed = Number.parseInt(trimmed, 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }

  private areTopicsEqual(left?: number, right?: number): boolean {
    if (typeof left === 'number' && typeof right === 'number') {
      return left === right;
    }
    return typeof left === 'undefined' && typeof right === 'undefined';
  }

  private areChatsEqual(
    left?: string | number,
    right?: string | number,
  ): boolean {
    return this.normalizeChatId(left) === this.normalizeChatId(right);
  }

  private buildPhotoAlbumIntro(
    task: Partial<TaskDocument> & Record<string, unknown>,
    options: {
      messageLink?: string | null;
      appLink?: string | null;
      topicId?: number | null;
    },
  ): {
    text: string;
    options: NonNullable<Parameters<typeof bot.telegram.sendMessage>[2]>;
  } {
    const title = typeof task.title === 'string' ? task.title.trim() : '';
    const text = title ? `*${escapeMarkdownV2(title)}*` : 'Фото по задаче';
    const messageLink = options.messageLink ?? null;
    const inlineKeyboard = messageLink
      ? [[{ text: 'Перейти к задаче', url: messageLink }]]
      : [];
    const replyMarkup = inlineKeyboard.length
      ? { inline_keyboard: inlineKeyboard }
      : undefined;
    const sendOptions: NonNullable<
      Parameters<typeof bot.telegram.sendMessage>[2]
    > = {
      parse_mode: 'MarkdownV2',
      link_preview_options: { is_disabled: true },
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    };
    if (typeof options.topicId === 'number') {
      sendOptions.message_thread_id = options.topicId;
    }
    return { text, options: sendOptions };
  }

  private async resolveTaskTopicId(
    task: Partial<TaskDocument> & Record<string, unknown>,
  ): Promise<number | undefined> {
    const direct = this.normalizeTopicId(task.telegram_topic_id);
    if (typeof direct === 'number') {
      return direct;
    }
    const type =
      typeof task.task_type === 'string' ? task.task_type.trim() : '';
    if (!type) {
      return undefined;
    }
    const topicId = await resolveTaskTypeTopicId(type);
    if (typeof topicId === 'number') {
      task.telegram_topic_id = topicId;
      return topicId;
    }
    return undefined;
  }

  private async deleteTaskMessageSafely(
    chat: string | number,
    messageId: number,
    expectedTopic?: number,
    actualTopic?: number,
  ): Promise<'deleted' | 'missing' | 'forbidden' | 'skipped' | 'failed'> {
    if (!Number.isFinite(messageId)) {
      return 'failed';
    }
    if (!this.areTopicsEqual(expectedTopic, actualTopic)) {
      console.warn('Пропускаем удаление сообщения задачи из другой темы', {
        expectedTopic,
        actualTopic,
        messageId,
      });
      return 'skipped';
    }
    try {
      await bot.telegram.deleteMessage(chat, messageId);
      return 'deleted';
    } catch (error) {
      if (this.isMessageMissingOnDeleteError(error)) {
        console.info(`Сообщение ${messageId} задачи уже удалено в Telegram`);
        return 'missing';
      }
      if (this.isMessageForbiddenToDeleteError(error)) {
        console.warn(
          `Сообщение ${messageId} задачи нельзя удалить в Telegram`,
          error,
        );
        return 'forbidden';
      }
      console.error(
        `Не удалось удалить сообщение ${messageId} задачи в Telegram`,
        error,
      );
      return 'failed';
    }
  }

  private async editTaskMessageInPlace(
    chat: string | number,
    messageId: number,
    message: string,
    keyboard: ReturnType<typeof taskStatusKeyboard>,
    topicId?: number,
  ): Promise<boolean> {
    const keyboardMarkup = this.extractKeyboardMarkup(keyboard);
    const options: Parameters<typeof bot.telegram.editMessageText>[4] = {
      parse_mode: 'MarkdownV2',
      link_preview_options: { is_disabled: true },
      ...(keyboardMarkup ? { reply_markup: keyboardMarkup } : {}),
    };
    const topicOptions =
      typeof topicId === 'number'
        ? ({ message_thread_id: topicId } as const)
        : {};
    const text = message.slice(0, TELEGRAM_MESSAGE_LIMIT);
    try {
      await bot.telegram.editMessageText(chat, messageId, undefined, text, {
        ...options,
        ...topicOptions,
      });
      return true;
    } catch (error) {
      console.error(
        `Не удалось обновить сообщение ${messageId} задачи в Telegram без удаления`,
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
        (typeof result === 'object' &&
        result !== null &&
        'matchedCount' in result
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

    const localPhotoInfoCache =
      cache ?? new Map<string, LocalPhotoInfo | null>();
    const resolvePhotoInput = (url: string) =>
      this.resolvePhotoInputWithCache(url, localPhotoInfoCache);

    const pendingImages: { url: string; caption?: string }[] = [];
    type SendMediaGroupOptions = Parameters<
      typeof bot.telegram.sendMediaGroup
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
    const sendSingleImage = async (current: {
      url: string;
      caption?: string;
    }) => {
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
        await this.persistTelegramFileId(
          current.url,
          this.extractTelegramPhotoId(response),
        );
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
        await this.persistTelegramFileId(
          current.url,
          this.extractTelegramDocumentId(response),
        );
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
          await Promise.all(
            response.map((message, index) => {
              const fileId = this.extractTelegramPhotoId(message);
              const source = batch[index]?.url;
              if (!fileId || !source) return Promise.resolve();
              return this.persistTelegramFileId(source, fileId);
            }),
          );
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
        pendingImages.push({
          url: attachment.url,
          caption: attachment.caption,
        });
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
          await this.persistTelegramFileId(
            attachment.url,
            this.extractTelegramDocumentId(response),
          );
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
    const normalizedMessageIds = messageIds.filter(
      (value): value is number =>
        typeof value === 'number' && Number.isFinite(value),
    );
    const previewIdSet = new Set(
      (previewMessageIds ?? []).filter(
        (value): value is number =>
          typeof value === 'number' && Number.isFinite(value),
      ),
    );
    const previewOnlyIds = normalizedMessageIds.filter((id) =>
      previewIdSet.has(id),
    );
    const nonPreviewIds = normalizedMessageIds.filter(
      (id) => !previewIdSet.has(id),
    );
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
            ? (previousAttachment.caption ?? '')
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
        const metaChanged =
          previousMime !== nextMime || previousName !== nextName;
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
            ? (previousAttachment.title ?? '')
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

  private isMessageNotModifiedError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const record = error as Record<string, unknown>;
    const rawResponse = record.response;
    const response =
      rawResponse && typeof rawResponse === 'object'
        ? (rawResponse as { error_code?: number; description?: unknown })
        : null;
    const descriptionRaw =
      response?.description ??
      (typeof record.description === 'string' ? record.description : null) ??
      null;
    const description =
      typeof descriptionRaw === 'string' ? descriptionRaw.toLowerCase() : '';
    return (
      response?.error_code === 400 &&
      description.includes('message is not modified')
    );
  }

  private isMessageMissingOnEditError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const record = error as Record<string, unknown>;
    const rawResponse = record.response;
    const response =
      rawResponse && typeof rawResponse === 'object'
        ? (rawResponse as { error_code?: number; description?: unknown })
        : null;
    const errorCode =
      response?.error_code ??
      (typeof record.error_code === 'number' ? record.error_code : null);
    if (errorCode !== 400) {
      return false;
    }
    const descriptionRaw =
      response?.description ??
      (typeof record.description === 'string' ? record.description : null) ??
      null;
    if (typeof descriptionRaw !== 'string') {
      return false;
    }
    const normalized = descriptionRaw.toLowerCase();
    return (
      normalized.includes('message to edit not found') ||
      normalized.includes('message to edit not found in the chat') ||
      normalized.includes('message with the specified identifier not found')
    );
  }

  private isMessageMissingOnDeleteError(error: unknown): boolean {
    const { errorCode, description } = this.parseTelegramError(error);
    return (
      errorCode === 400 &&
      Boolean(description?.includes('message to delete not found'))
    );
  }

  private isMessageForbiddenToDeleteError(error: unknown): boolean {
    const { errorCode, description } = this.parseTelegramError(error);
    return (
      errorCode === 400 &&
      Boolean(description?.includes("message can't be deleted"))
    );
  }

  private parseTelegramError(error: unknown): {
    errorCode: number | null;
    description: string | null;
  } {
    if (!error || typeof error !== 'object') {
      return { errorCode: null, description: null };
    }
    const record = error as Record<string, unknown>;
    const rawResponse = record.response;
    const response =
      rawResponse && typeof rawResponse === 'object'
        ? (rawResponse as { error_code?: number; description?: unknown })
        : null;
    const errorCode =
      response?.error_code ??
      (typeof record.error_code === 'number' ? record.error_code : null);
    const descriptionRaw =
      response?.description ??
      (typeof record.description === 'string' ? record.description : null) ??
      null;
    return {
      errorCode,
      description:
        typeof descriptionRaw === 'string'
          ? descriptionRaw.toLowerCase()
          : null,
    };
  }

  private async broadcastTaskSnapshot(
    task: TaskDocument,
    actorId: number,
    options?: {
      previous?: (TaskWithMeta & Record<string, unknown>) | null;
      action?: 'создана' | 'обновлена';
      note?: string | null;
    },
  ) {
    const docId =
      typeof task._id === 'object' &&
      task._id !== null &&
      'toString' in task._id
        ? (task._id as { toString(): string }).toString()
        : String(task._id ?? '');
    if (!docId) return;

    const plain = (
      typeof task.toObject === 'function' ? task.toObject() : (task as unknown)
    ) as TaskWithMeta & Record<string, unknown>;
    const previousPlain = options?.previous ?? null;
    const action = options?.action ?? 'создана';
    const noteRaw =
      typeof options?.note === 'string' ? options.note.trim() : '';
    const dmNote = noteRaw || (action === 'обновлена' ? 'Задачу обновили' : '');

    const groupChatId = resolveGroupChatId();
    const normalizedGroupChatId = this.normalizeChatId(groupChatId);
    const photosTarget = await resolveTaskTypePhotosTarget(plain.task_type);
    const configuredPhotosChatId = this.normalizeChatId(photosTarget?.chatId);
    const configuredPhotosTopicId = this.normalizeTopicId(
      photosTarget?.topicId,
    );
    const previousPhotosChatId = this.normalizeChatId(
      previousPlain?.telegram_photos_chat_id,
    );
    const previousPhotosTopicId = this.normalizeTopicId(
      previousPlain?.telegram_photos_topic_id,
    );
    const previousPhotosMessageId = this.toMessageId(
      previousPlain?.telegram_photos_message_id,
    );
    const previousCommentMessageId = this.toMessageId(
      previousPlain?.telegram_comment_message_id,
    );

    const recipients = this.collectNotificationTargets(plain, actorId);
    let users: Record<number, TaskUserProfile> = {};
    try {
      const usersRaw = await getUsersMap(Array.from(recipients));
      users = Object.fromEntries(
        Object.entries(usersRaw).map(([key, value]) => {
          const name = value.name ?? value.username ?? '';
          const username = value.username ?? '';
          const isBot = value?.is_bot === true;
          return [Number(key), { name, username, isBot } as TaskUserProfile];
        }),
      );
    } catch (error) {
      console.error('Не удалось получить данные пользователей задачи', error);
    }

    const kind = detectTaskKind(plain);
    const keyboard = taskStatusKeyboard(
      docId,
      typeof plain.status === 'string'
        ? (plain.status as SharedTask['status'])
        : undefined,
      { kind },
      { showCommentButton: true },
    );
    const formatted = formatTask(plain as unknown as SharedTask, users);
    const message = formatted.text;
    const topicId = await this.resolveTaskTopicId(plain);
    const previousTopicId = this.normalizeTopicId(
      previousPlain?.telegram_topic_id,
    );
    const normalizeMessageIds = (value: unknown): number[] =>
      Array.isArray(value)
        ? (value as unknown[])
            .map((item) =>
              typeof item === 'number' && Number.isFinite(item) ? item : null,
            )
            .filter((item): item is number => item !== null)
        : [];

    const taskAppLink = buildTaskAppLink(plain);

    let groupMessageId: number | undefined;
    let messageLink: string | null = null;
    let attachmentMessageIds: number[] = [];
    let previewMessageIds: number[] = [];
    let directMessages: DirectMessageEntry[] = [];
    let photosMessageId: number | undefined;
    let photosChatId: string | undefined;
    let photosTopicId: number | undefined;
    let albumLinkForKeyboard: string | null = null;
    let commentMessageId: number | undefined;

    if (groupChatId) {
      try {
        let reuseExistingMessage = false;
        let previousMessageId: number | undefined;
        if (previousPlain) {
          previousMessageId =
            typeof previousPlain.telegram_message_id === 'number'
              ? previousPlain.telegram_message_id
              : undefined;
          const deletionResult = previousMessageId
            ? await this.deleteTaskMessageSafely(
                groupChatId,
                previousMessageId,
                previousTopicId,
                topicId,
              )
            : 'failed';
          if (deletionResult === 'forbidden' && previousMessageId) {
            const updatedInPlace = await this.editTaskMessageInPlace(
              groupChatId,
              previousMessageId,
              message,
              keyboard,
              previousTopicId ?? topicId,
            );
            if (updatedInPlace) {
              reuseExistingMessage = true;
              groupMessageId = previousMessageId;
              messageLink = buildChatMessageLink(
                groupChatId,
                previousMessageId,
                previousTopicId ?? topicId,
              );
              previewMessageIds = normalizeMessageIds(
                previousPlain.telegram_preview_message_ids,
              );
              attachmentMessageIds = normalizeMessageIds(
                previousPlain.telegram_attachments_message_ids,
              );
              photosMessageId = previousPhotosMessageId;
              photosChatId = previousPhotosChatId ?? normalizedGroupChatId;
              photosTopicId = previousPhotosTopicId;
            }
          }

          if (!reuseExistingMessage) {
            const previousPreviewIds = normalizeMessageIds(
              previousPlain.telegram_preview_message_ids,
            );
            const previousAttachmentIds = normalizeMessageIds(
              previousPlain.telegram_attachments_message_ids,
            );
            const cleanupTargets = new Set<number>();
            if (typeof previousPlain.telegram_history_message_id === 'number') {
              cleanupTargets.add(previousPlain.telegram_history_message_id);
            }
            if (typeof previousPlain.telegram_status_message_id === 'number') {
              cleanupTargets.add(previousPlain.telegram_status_message_id);
            }
            if (typeof previousPlain.telegram_comment_message_id === 'number') {
              cleanupTargets.add(previousPlain.telegram_comment_message_id);
            }
            if (previousPreviewIds.length) {
              const previousAttachmentChatId =
                previousPhotosChatId ?? normalizedGroupChatId;
              if (previousAttachmentChatId) {
                await this.deleteAttachmentMessages(
                  previousAttachmentChatId,
                  previousPreviewIds,
                );
              }
            }
            if (previousAttachmentIds.length) {
              const previousAttachmentChatId =
                previousPhotosChatId ?? normalizedGroupChatId;
              if (previousAttachmentChatId) {
                await this.deleteAttachmentMessages(
                  previousAttachmentChatId,
                  previousAttachmentIds,
                );
              }
            }
            for (const messageId of cleanupTargets) {
              await this.deleteTaskMessageSafely(
                groupChatId,
                messageId,
                previousTopicId,
                topicId,
              );
            }
            if (previousPhotosMessageId) {
              const photosChat = previousPhotosChatId ?? normalizedGroupChatId;
              if (photosChat) {
                await this.deleteTaskMessageSafely(
                  photosChat,
                  previousPhotosMessageId,
                  previousPhotosTopicId,
                  previousPhotosTopicId,
                );
              }
            }
          }
        }

        const attachmentsChatValue =
          configuredPhotosChatId ?? groupChatId ?? normalizedGroupChatId;
        const normalizedAttachmentsChatId =
          this.normalizeChatId(attachmentsChatValue);
        const attachmentsTopicIdForSend = (() => {
          if (typeof configuredPhotosTopicId === 'number') {
            return configuredPhotosTopicId;
          }
          if (
            normalizedAttachmentsChatId &&
            !this.areChatsEqual(
              normalizedAttachmentsChatId,
              normalizedGroupChatId,
            )
          ) {
            return undefined;
          }
          return topicId;
        })();
        const useSeparatePhotosChat = Boolean(
          normalizedAttachmentsChatId &&
            !this.areChatsEqual(
              normalizedAttachmentsChatId,
              normalizedGroupChatId,
            ),
        );
        const useSeparatePhotosTopic =
          typeof attachmentsTopicIdForSend === 'number' &&
          !this.areTopicsEqual(attachmentsTopicIdForSend, topicId);
        const shouldSendAttachmentsSeparately = Boolean(
          normalizedAttachmentsChatId &&
            (useSeparatePhotosChat || useSeparatePhotosTopic),
        );

        if (!reuseExistingMessage) {
          const media = this.collectSendableAttachments(
            plain,
            formatted.inlineImages,
          );
          const sendResult = await this.sendTaskMessageWithPreview(
            groupChatId,
            message,
            formatted.sections,
            media,
            keyboard,
            topicId,
            { skipAlbum: shouldSendAttachmentsSeparately },
          );
          groupMessageId = sendResult.messageId;
          previewMessageIds = sendResult.previewMessageIds ?? [];
          messageLink = buildChatMessageLink(
            groupChatId,
            groupMessageId,
            topicId,
          );
          if (
            !shouldSendAttachmentsSeparately &&
            Array.isArray(sendResult.previewMessageIds) &&
            sendResult.previewMessageIds.length > 0
          ) {
            const albumMessageId = sendResult.previewMessageIds[0];
            if (typeof albumMessageId === 'number') {
              albumLinkForKeyboard = buildChatMessageLink(
                groupChatId,
                albumMessageId,
                topicId,
              );
            }
          }
          const consumedUrls = new Set(
            (sendResult.consumedAttachmentUrls ?? []).filter((url) =>
              Boolean(url),
            ),
          );
          const extras = shouldSendAttachmentsSeparately
            ? media.extras
            : consumedUrls.size
              ? media.extras.filter((attachment) =>
                  attachment.kind === 'image'
                    ? !consumedUrls.has(attachment.url)
                    : true,
                )
              : media.extras;
          let albumIntroMessageId: number | undefined;

          if (extras.length) {
            const shouldSendAlbumIntro = shouldSendAttachmentsSeparately;
            let albumMessageId: number | undefined;
            if (shouldSendAlbumIntro && normalizedAttachmentsChatId) {
              const intro = this.buildPhotoAlbumIntro(plain, {
                messageLink,
                appLink: taskAppLink ?? null,
                topicId: attachmentsTopicIdForSend ?? undefined,
              });
              try {
                const response = await bot.telegram.sendMessage(
                  normalizedAttachmentsChatId,
                  intro.text,
                  intro.options,
                );
                if (response?.message_id) {
                  albumMessageId = response.message_id;
                  albumIntroMessageId = response.message_id;
                }
              } catch (error) {
                console.error(
                  'Не удалось отправить описание альбома задачи',
                  error,
                );
              }
            }
            const shouldReplyToGroup = Boolean(
              normalizedAttachmentsChatId &&
                this.areChatsEqual(
                  normalizedAttachmentsChatId,
                  normalizedGroupChatId,
                ) &&
                this.areTopicsEqual(attachmentsTopicIdForSend, topicId),
            );
            if (attachmentsChatValue) {
              try {
                const replyTo = albumMessageId
                  ? albumMessageId
                  : shouldReplyToGroup
                    ? groupMessageId
                    : undefined;
                attachmentMessageIds = await this.sendTaskAttachments(
                  attachmentsChatValue,
                  extras,
                  attachmentsTopicIdForSend,
                  replyTo,
                  sendResult.cache,
                );
                if (
                  typeof albumMessageId === 'number' &&
                  normalizedAttachmentsChatId
                ) {
                  photosMessageId = albumMessageId;
                  photosChatId = normalizedAttachmentsChatId;
                  photosTopicId =
                    typeof attachmentsTopicIdForSend === 'number'
                      ? attachmentsTopicIdForSend
                      : undefined;
                  albumLinkForKeyboard =
                    buildChatMessageLink(
                      normalizedAttachmentsChatId,
                      albumMessageId,
                      attachmentsTopicIdForSend,
                    ) ?? albumLinkForKeyboard;
                }
              } catch (error) {
                console.error('Не удалось отправить вложения задачи', error);
              }
            }
          }

          if (
            typeof albumIntroMessageId === 'number' &&
            normalizedAttachmentsChatId
          ) {
            await delay(ALBUM_MESSAGE_DELAY_MS);
          }

          if (
            groupMessageId &&
            groupChatId &&
            docId &&
            typeof docId === 'string'
          ) {
            const currentStatus =
              typeof plain.status === 'string'
                ? (plain.status as SharedTask['status'])
                : undefined;
            await this.updateTaskAlbumKeyboard(
              groupChatId,
              groupMessageId,
              docId,
              currentStatus,
              kind,
              albumLinkForKeyboard,
            );
          }
        }
      } catch (error) {
        console.error('Не удалось отправить уведомление в группу', error);
      }
    }

    if (groupChatId) {
      const baseMessageId =
        typeof groupMessageId === 'number'
          ? groupMessageId
          : this.toMessageId(plain.telegram_message_id);
      const commentContent =
        typeof plain.comment === 'string' ? plain.comment : '';
      try {
        if (typeof baseMessageId === 'number') {
          const commentHtml = ensureCommentHtml(commentContent);
          commentMessageId = await syncCommentMessage({
            bot,
            chatId: groupChatId,
            topicId,
            replyTo: baseMessageId,
            messageId: previousCommentMessageId ?? undefined,
            commentHtml,
            detectors: {
              notModified: this.isMessageNotModifiedError.bind(this),
              missingOnEdit: this.isMessageMissingOnEditError.bind(this),
              missingOnDelete: this.isMessageMissingOnDeleteError.bind(this),
            },
          });
        } else if (typeof previousCommentMessageId === 'number') {
          await syncCommentMessage({
            bot,
            chatId: groupChatId,
            topicId,
            messageId: previousCommentMessageId,
            commentHtml: '',
            detectors: {
              missingOnDelete: this.isMessageMissingOnDeleteError.bind(this),
            },
          });
          commentMessageId = undefined;
        }
      } catch (error) {
        console.error('Не удалось синхронизировать комментарий задачи', error);
        commentMessageId = previousCommentMessageId ?? undefined;
      }
    } else {
      commentMessageId = previousCommentMessageId ?? undefined;
    }

    if (groupMessageId) {
      plain.telegram_message_id = groupMessageId;
    } else {
      delete plain.telegram_message_id;
    }
    delete plain.telegram_summary_message_id;
    delete plain.telegram_history_message_id;
    delete plain.telegram_status_message_id;
    if (typeof commentMessageId === 'number') {
      plain.telegram_comment_message_id = commentMessageId;
    } else {
      delete plain.telegram_comment_message_id;
    }
    plain.telegram_preview_message_ids = previewMessageIds;
    plain.telegram_attachments_message_ids = attachmentMessageIds;
    if (typeof photosMessageId === 'number' && photosChatId) {
      plain.telegram_photos_chat_id = photosChatId;
      if (typeof photosTopicId === 'number') {
        plain.telegram_photos_topic_id = photosTopicId;
      } else {
        delete plain.telegram_photos_topic_id;
      }
      plain.telegram_photos_message_id = photosMessageId;
    } else {
      delete plain.telegram_photos_chat_id;
      delete plain.telegram_photos_topic_id;
      delete plain.telegram_photos_message_id;
    }

    const previousDirectMessages = this.normalizeDirectMessages(
      previousPlain?.telegram_dm_message_ids,
    );
    await this.deleteDirectMessages(previousDirectMessages);

    const assignees = this.collectAssignees(plain);
    const normalizedActorId =
      typeof actorId === 'number' || typeof actorId === 'string'
        ? Number(actorId)
        : NaN;
    if (Number.isFinite(normalizedActorId)) {
      // Не отправляем личное сообщение инициатору действия.
      assignees.delete(normalizedActorId);
    }
    if (assignees.size) {
      const dmKeyboard = buildDirectTaskKeyboard(
        messageLink,
        taskAppLink ?? undefined,
      );
      const dmOptions: SendMessageOptions = {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        ...(dmKeyboard?.reply_markup
          ? { reply_markup: dmKeyboard.reply_markup }
          : {}),
      };
      const dmText = buildDirectTaskMessage(
        plain,
        messageLink,
        users,
        taskAppLink,
        dmNote ? { note: dmNote } : undefined,
      );
      for (const userId of assignees) {
        const profile = users[userId];
        if (profile?.isBot) {
          console.info(
            `Получатель ${userId} отмечен как бот, личное уведомление пропущено`,
          );
          continue;
        }
        try {
          const sent = await bot.telegram.sendMessage(
            userId,
            dmText,
            dmOptions,
          );
          if (sent?.message_id) {
            directMessages.push({
              user_id: userId,
              message_id: sent.message_id,
            });
          }
        } catch (error) {
          if (this.isBotRecipientError(error)) {
            console.warn(
              `Получатель ${userId} является ботом, личное уведомление не отправлено`,
              error,
            );
            if (profile) {
              profile.isBot = true;
            }
            await this.markUserAsBot(userId);
            continue;
          }
          if (this.isConversationStartRequiredError(error)) {
            console.warn(
              `Пользователь ${userId} ещё не начал диалог с ботом, личное уведомление пропущено`,
              error,
            );
            continue;
          }
          console.error(
            `Не удалось отправить уведомление пользователю ${userId}`,
            error,
          );
        }
      }
    }
    plain.telegram_dm_message_ids = directMessages;

    const setPayload: Record<string, unknown> = {};
    const unsetPayload: Record<string, unknown> = {};

    if (groupMessageId) {
      setPayload.telegram_message_id = groupMessageId;
    } else {
      unsetPayload.telegram_message_id = '';
    }
    unsetPayload.telegram_summary_message_id = '';
    unsetPayload.telegram_history_message_id = '';
    unsetPayload.telegram_status_message_id = '';
    if (previewMessageIds.length) {
      setPayload.telegram_preview_message_ids = previewMessageIds;
    } else {
      unsetPayload.telegram_preview_message_ids = '';
    }
    if (attachmentMessageIds.length) {
      setPayload.telegram_attachments_message_ids = attachmentMessageIds;
    } else {
      unsetPayload.telegram_attachments_message_ids = '';
    }
    const resolvedPhotosChatId = photosChatId ?? normalizedGroupChatId;
    if (typeof photosMessageId === 'number' && resolvedPhotosChatId) {
      setPayload.telegram_photos_message_id = photosMessageId;
      setPayload.telegram_photos_chat_id = resolvedPhotosChatId;
      if (typeof photosTopicId === 'number') {
        setPayload.telegram_photos_topic_id = photosTopicId;
      } else {
        unsetPayload.telegram_photos_topic_id = '';
      }
    } else {
      unsetPayload.telegram_photos_message_id = '';
      unsetPayload.telegram_photos_chat_id = '';
      unsetPayload.telegram_photos_topic_id = '';
    }
    if (typeof commentMessageId === 'number') {
      setPayload.telegram_comment_message_id = commentMessageId;
    } else {
      unsetPayload.telegram_comment_message_id = '';
    }
    if (directMessages.length) {
      setPayload.telegram_dm_message_ids = directMessages;
    } else {
      unsetPayload.telegram_dm_message_ids = '';
    }
    unsetPayload.telegram_message_cleanup = '';

    const updatePayload: Record<string, unknown> = {};
    if (Object.keys(setPayload).length) {
      updatePayload.$set = setPayload;
    }
    if (Object.keys(unsetPayload).length) {
      updatePayload.$unset = unsetPayload;
    }
    if (Object.keys(updatePayload).length) {
      try {
        await Task.findByIdAndUpdate(docId, updatePayload).exec();
      } catch (error) {
        console.error(
          'Не удалось сохранить идентификаторы сообщений задачи',
          error,
        );
      }
    }
  }

  private async notifyTaskCreated(task: TaskDocument, creatorId: number) {
    await this.broadcastTaskSnapshot(task, creatorId, { action: 'создана' });
  }

  downloadPdf = async (req: RequestWithUser, res: Response) => {
    try {
      const filters = { ...(req.query as Record<string, unknown>) };
      const result = await this.reportGenerator.generatePdf(filters, req.user);
      res.setHeader('Content-Type', result.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.fileName}"`,
      );
      res.setHeader('Content-Length', String(result.data.length));
      res.send(result.data);
    } catch (error) {
      console.error('Не удалось сформировать PDF отчёт задач', error);
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Ошибка генерации отчёта',
        status: 500,
        detail: 'Не удалось сформировать PDF отчёт',
      });
    }
  };

  downloadExcel = async (req: RequestWithUser, res: Response) => {
    try {
      const filters = { ...(req.query as Record<string, unknown>) };
      const result = await this.reportGenerator.generateExcel(
        filters,
        req.user,
      );
      res.setHeader('Content-Type', result.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.fileName}"`,
      );
      res.setHeader('Content-Length', String(result.data.length));
      res.send(result.data);
    } catch (error) {
      console.error('Не удалось сформировать Excel отчёт задач', error);
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Ошибка генерации отчёта',
        status: 500,
        detail: 'Не удалось сформировать Excel отчёт',
      });
    }
  };

  list = async (req: RequestWithUser, res: Response) => {
    const { page, limit, ...filters } = req.query;
    const pageNumber = page ? Number(page) : undefined;
    const limitNumber = limit ? Number(limit) : undefined;

    const {
      normalized: normalizedFilters,
      statusValues,
      taskTypeValues,
      assigneeValues,
      kindFilter,
    } = normalizeTaskFilters(filters as Record<string, unknown>);

    let tasks: TaskEx[];
    let total = 0;
    if (['admin', 'manager'].includes(req.user!.role || '')) {
      const result = await this.service.get(
        normalizedFilters,
        pageNumber,
        limitNumber,
      );
      tasks = result.tasks as unknown as TaskEx[];
      total = result.total;
    } else {
      tasks = (await this.service.mentioned(
        String(req.user!.id),
      )) as unknown as TaskEx[];
      if (kindFilter) {
        tasks = tasks.filter((task) => detectTaskKind(task) === kindFilter);
      }
      if (statusValues.length) {
        const statusSet = new Set(statusValues);
        tasks = tasks.filter((task) =>
          typeof task.status === 'string'
            ? statusSet.has(task.status.trim())
            : false,
        );
      }
      if (taskTypeValues.length) {
        const typeSet = new Set(taskTypeValues);
        tasks = tasks.filter((task) => {
          const typeValue =
            typeof (task as Record<string, unknown>).task_type === 'string'
              ? ((task as Record<string, unknown>).task_type as string).trim()
              : '';
          return typeValue ? typeSet.has(typeValue) : false;
        });
      }
      if (assigneeValues.length) {
        const assigneeSet = new Set(assigneeValues.map((id) => Number(id)));
        tasks = tasks.filter((task) => {
          const recipients = new Set<number>();
          const collect = (value: unknown) => {
            if (typeof value === 'number' && Number.isFinite(value)) {
              recipients.add(value);
            } else if (typeof value === 'string') {
              const parsed = Number(value.trim());
              if (Number.isFinite(parsed)) {
                recipients.add(parsed);
              }
            }
          };
          if (Array.isArray(task.assignees)) {
            task.assignees.forEach(collect);
          }
          collect((task as Record<string, unknown>).assigned_user_id);
          return Array.from(recipients).some((recipient) =>
            assigneeSet.has(recipient),
          );
        });
      }
      total = tasks.length;
    }
    const normalizedTasks = tasks
      .map((task) => this.normalizeTaskResponse(task))
      .filter((task): task is TaskEx => Boolean(task));

    const ids = new Set<number>();
    normalizedTasks.forEach((t) => {
      (t.assignees || []).forEach((id: number) => ids.add(id));
      (t.controllers || []).forEach((id: number) => ids.add(id));
      if (t.created_by) ids.add(t.created_by);
      if (typeof t.transport_driver_id === 'number')
        ids.add(t.transport_driver_id);
      (t.history || []).forEach((h) => ids.add(h.changed_by));
    });
    const users = await getUsersMap(Array.from(ids));
    sendCached(req, res, { tasks: normalizedTasks, users, total });
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
    if (typeof task.transport_driver_id === 'number')
      ids.add(task.transport_driver_id);
    (task.history || []).forEach((h) => ids.add(h.changed_by));
    const users = await getUsersMap(Array.from(ids));
    const normalizedTask = this.normalizeTaskResponse(task);
    res.json({ task: normalizedTask, users });
  };

  create = [
    handleValidation,
    async (req: RequestWithUser, res: Response) => {
      const actorId = Number(req.user!.id);
      const payload = req.body as Partial<TaskDocument>;
      const detectedKind = detectTaskKind(payload);
      if (detectedKind === 'request') {
        const source: unknown[] = Array.isArray(payload.assignees)
          ? [...payload.assignees]
          : [];
        if (payload.assigned_user_id !== undefined) {
          source.push(payload.assigned_user_id);
        }
        const allowed = await this.resolveAdminExecutors(source);
        if (!allowed.length) {
          await cleanupRequestUploads(req);
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Исполнители недоступны',
            status: 403,
            detail: 'Для заявки можно выбрать только администратора',
          });
          return;
        }
        payload.kind = 'request';
        payload.task_type = REQUEST_TYPE_NAME;
        payload.status = 'Новая';
        payload.created_by = actorId;
        payload.assignees = allowed;
        payload.assigned_user_id = allowed[0];
      } else {
        payload.kind = 'task';
      }
      if (!(await this.applyPointsPayload(payload, req, res))) {
        await cleanupRequestUploads(req);
        return;
      }
      let task: TaskDocument;
      try {
        task = (await this.service.create(payload, actorId)) as TaskDocument;
      } catch (error) {
        await cleanupRequestUploads(req);
        const err = error as { code?: string; message?: string };
        if (err.code === 'TRANSPORT_FIELDS_REQUIRED') {
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Транспорт не заполнен',
            status: 422,
            detail: 'Укажите водителя и транспорт для выбранного типа',
          });
          return;
        }
        throw error;
      }
      try {
        const finalizeResult = await finalizeTaskUploads({
          req,
          taskId: String(task._id),
          attachments: Array.isArray(payload.attachments)
            ? (payload.attachments as Attachment[])
            : undefined,
        });
        (payload as Record<string, unknown>).attachments =
          finalizeResult.attachments as Attachment[];
        (task as unknown as Record<string, unknown>).attachments =
          finalizeResult.attachments as Attachment[];
      } catch (error) {
        await cleanupRequestUploads(req);
        throw error;
      }
      const label = resolveTaskLabel(detectTaskKind(task));
      await writeLog(
        `Создана ${label.toLowerCase()} ${task._id} пользователем ${req.user!.id}/${req.user!.username}`,
      );
      const normalizedTask = this.normalizeTaskResponse(task);
      res.status(201).json(normalizedTask);
      if (process.env.DISABLE_TASK_NOTIFICATIONS !== 'true') {
        void this.notifyTaskCreated(task, actorId).catch((error) => {
          console.error(
            'Не удалось отправить уведомление о создании задачи',
            error,
          );
        });
      }
    },
  ];

  createRequest = [
    handleValidation,
    async (req: RequestWithUser, res: Response) => {
      const actorId = Number(req.user!.id);
      const payload = req.body as Partial<TaskDocument>;
      const source: unknown[] = Array.isArray(payload.assignees)
        ? [...payload.assignees]
        : [];
      if (payload.assigned_user_id !== undefined) {
        source.push(payload.assigned_user_id);
      }
      const allowed = await this.resolveAdminExecutors(source);
      if (!allowed.length) {
        await cleanupRequestUploads(req);
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Исполнители недоступны',
          status: 403,
          detail: 'Для заявки можно выбрать только администратора',
        });
        return;
      }
      payload.kind = 'request';
      payload.task_type = REQUEST_TYPE_NAME;
      payload.status = 'Новая';
      payload.created_by = actorId;
      payload.assignees = allowed;
      payload.assigned_user_id = allowed[0];
      if (!(await this.applyPointsPayload(payload, req, res))) {
        await cleanupRequestUploads(req);
        return;
      }
      let task: TaskDocument;
      try {
        task = (await this.service.create(payload, actorId)) as TaskDocument;
      } catch (error) {
        await cleanupRequestUploads(req);
        throw error;
      }
      try {
        const finalizeResult = await finalizeTaskUploads({
          req,
          taskId: String(task._id),
          attachments: Array.isArray(payload.attachments)
            ? (payload.attachments as Attachment[])
            : undefined,
        });
        (payload as Record<string, unknown>).attachments =
          finalizeResult.attachments as Attachment[];
        (task as unknown as Record<string, unknown>).attachments =
          finalizeResult.attachments as Attachment[];
      } catch (error) {
        await cleanupRequestUploads(req);
        throw error;
      }
      await writeLog(
        `Создана заявка ${task._id} пользователем ${req.user!.id}/${req.user!.username}`,
      );
      const normalizedTask = this.normalizeTaskResponse(task);
      res.status(201).json(normalizedTask);
      if (process.env.DISABLE_TASK_NOTIFICATIONS !== 'true') {
        void this.notifyTaskCreated(task, actorId).catch((error) => {
          console.error(
            'Не удалось отправить уведомление о создании задачи',
            error,
          );
        });
      }
    },
  ];

  update = [
    handleValidation,
    async (req: RequestWithUser, res: Response) => {
      const previousRaw = await Task.findById(req.params.id);
      const previousTask = previousRaw
        ? ((typeof previousRaw.toObject === 'function'
            ? (previousRaw.toObject() as unknown)
            : (previousRaw as unknown)) as TaskWithMeta &
            Record<string, unknown>)
        : null;
      if (!previousTask) {
        await cleanupRequestUploads(req);
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Задача не найдена',
          status: 404,
          detail: 'Not Found',
        });
        return;
      }
      const actorIdRaw = req.user?.id;
      const actorId =
        typeof actorIdRaw === 'number' && Number.isFinite(actorIdRaw)
          ? actorIdRaw
          : typeof actorIdRaw === 'string'
            ? Number(actorIdRaw.trim())
            : Number.NaN;
      if (!Number.isFinite(actorId)) {
        await cleanupRequestUploads(req);
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Ошибка авторизации',
          status: 403,
          detail: 'Не удалось определить пользователя',
        });
        return;
      }
      const nextPayload = req.body as Partial<TaskDocument>;
      const previousKind = detectTaskKind(previousTask);
      if (previousKind === 'request') {
        if (
          typeof nextPayload.kind === 'string' &&
          nextPayload.kind.trim() !== 'request'
        ) {
          await cleanupRequestUploads(req);
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Изменение типа запрещено',
            status: 409,
            detail: 'Заявку нельзя преобразовать в задачу',
          });
          return;
        }
        if (
          Object.prototype.hasOwnProperty.call(nextPayload, 'task_type') &&
          typeof nextPayload.task_type === 'string' &&
          nextPayload.task_type.trim() !== REQUEST_TYPE_NAME
        ) {
          await cleanupRequestUploads(req);
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Изменение типа запрещено',
            status: 409,
            detail: 'Заявку нельзя преобразовать в задачу',
          });
          return;
        }
        if (
          Object.prototype.hasOwnProperty.call(nextPayload, 'assignees') ||
          Object.prototype.hasOwnProperty.call(nextPayload, 'assigned_user_id')
        ) {
          const source: unknown[] = Array.isArray(nextPayload.assignees)
            ? [...nextPayload.assignees]
            : [];
          if (nextPayload.assigned_user_id !== undefined) {
            source.push(nextPayload.assigned_user_id);
          }
          const allowed = await this.resolveAdminExecutors(source);
          if (!allowed.length) {
            await cleanupRequestUploads(req);
            sendProblem(req, res, {
              type: 'about:blank',
              title: 'Исполнители недоступны',
              status: 403,
              detail: 'Для заявки можно выбрать только администратора',
            });
            return;
          }
          nextPayload.assignees = allowed;
          const assignedNumeric = Number(nextPayload.assigned_user_id);
          nextPayload.assigned_user_id = allowed.includes(assignedNumeric)
            ? assignedNumeric
            : allowed[0];
        }
        nextPayload.kind = 'request';
        nextPayload.task_type = REQUEST_TYPE_NAME;
      }
      const currentStatus =
        typeof previousTask.status === 'string'
          ? (previousTask.status as TaskDocument['status'])
          : undefined;
      const isCreator =
        Number.isFinite(Number(req.user?.id)) &&
        Number(previousTask.created_by) === Number(req.user?.id);
      const assignedIds = new Set<number>();
      if (typeof previousTask.assigned_user_id === 'number') {
        assignedIds.add(previousTask.assigned_user_id);
      }
      if (Array.isArray(previousTask.assignees)) {
        previousTask.assignees
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
          .forEach((value) => assignedIds.add(value));
      }
      const controllerIds = new Set<number>();
      const primaryController = Number(previousTask.controller_user_id);
      if (Number.isFinite(primaryController)) {
        controllerIds.add(primaryController);
      }
      if (Array.isArray(previousTask.controllers)) {
        previousTask.controllers
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
          .forEach((value) => controllerIds.add(value));
      }
      const actorAccess = Number(req.user?.access ?? 0);
      const actorRole = typeof req.user?.role === 'string' ? req.user.role : '';
      const hasDeleteAccess = hasAccessMask(actorAccess, ACCESS_TASK_DELETE);
      const hasAdminRights =
        actorRole === 'admin' ||
        hasAccessMask(actorAccess, ACCESS_ADMIN) ||
        hasDeleteAccess;
      const hasManagerRights =
        hasAccessMask(actorAccess, ACCESS_MANAGER) || hasDeleteAccess;
      const isTerminal = isTerminalStatus(currentStatus);
      const isExecutor = assignedIds.has(actorId);
      const isController = controllerIds.has(actorId);
      const isActorLinked = isCreator || isExecutor || isController;
      const changedKeys = Object.entries(nextPayload)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key);
      const requestedStatus =
        typeof nextPayload.status === 'string'
          ? (nextPayload.status as TaskDocument['status'])
          : undefined;
      const isStatusOnlyUpdate =
        changedKeys.length === 1 && changedKeys[0] === 'status';
      const isUserStatusAllowed =
        isActorLinked &&
        isStatusOnlyUpdate &&
        isUserStatusTransitionAllowed(currentStatus, requestedStatus);
      const canEditTask =
        hasDeleteAccess ||
        (!isTerminal &&
          (hasAdminRights || (hasManagerRights && isActorLinked)));
      const denyStatus = isTerminal && !hasDeleteAccess ? 409 : 403;
      const denyDetail = (() => {
        if (isTerminal) {
          return 'Редактирование недоступно для задач в статусах «Выполнена» и «Отменена»';
        }
        if (isStatusOnlyUpdate && isActorLinked) {
          return 'Исполнителю доступны только статусы «В работе» и «Выполнена» из статуса «Новая»';
        }
        return 'Недостаточно прав для изменения задачи';
      })();
      if (!canEditTask && !isUserStatusAllowed) {
        await cleanupRequestUploads(req);
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Редактирование запрещено',
          status: denyStatus,
          detail: denyDetail,
        });
        return;
      }
      if (!(await this.applyPointsPayload(nextPayload, req, res))) {
        await cleanupRequestUploads(req);
        return;
      }
      let task: TaskDocument | null;
      try {
        task = await this.service.update(req.params.id, nextPayload, actorId, {
          adminOverride: hasDeleteAccess,
        });
      } catch (error) {
        await cleanupRequestUploads(req);
        const err = error as { code?: string; message?: string };
        if (err.code === 'TRANSPORT_FIELDS_REQUIRED') {
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Транспорт не заполнен',
            status: 422,
            detail: 'Укажите водителя и транспорт для выбранного типа',
          });
          return;
        }
        if (
          err.code === 'TASK_CANCEL_FORBIDDEN' ||
          err.code === 'TASK_REQUEST_CANCEL_FORBIDDEN' ||
          err.code === 'TASK_CANCEL_SOURCE_FORBIDDEN'
        ) {
          await cleanupRequestUploads(req);
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Доступ запрещён',
            status: 403,
            detail: err.message || 'Нет прав для изменения статуса',
          });
          return;
        }
        throw error;
      }
      if (!task) {
        const current = await Task.findById(req.params.id);
        if (
          current &&
          typeof current.status === 'string' &&
          isTerminalStatus(current.status) &&
          !hasDeleteAccess
        ) {
          await cleanupRequestUploads(req);
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Редактирование запрещено',
            status: denyStatus,
            detail: denyDetail,
          });
        } else {
          await cleanupRequestUploads(req);
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Задача не найдена',
            status: 404,
            detail: 'Not Found',
          });
        }
        return;
      }
      try {
        const finalizeResult = await finalizeTaskUploads({
          req,
          taskId: String(task._id),
          attachments: Array.isArray(nextPayload.attachments)
            ? (nextPayload.attachments as Attachment[])
            : undefined,
        });
        if (Object.prototype.hasOwnProperty.call(nextPayload, 'attachments')) {
          (nextPayload as Record<string, unknown>).attachments =
            finalizeResult.attachments as Attachment[];
        }
        (task as unknown as Record<string, unknown>).attachments =
          finalizeResult.attachments as Attachment[];
      } catch (error) {
        await cleanupRequestUploads(req);
        throw error;
      }
      const changedFields = Object.entries(nextPayload)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key);
      await writeLog(
        `Обновлена задача ${req.params.id} пользователем ${req.user!.id}/${req.user!.username}`,
        'info',
        {
          taskId: req.params.id,
          userId: req.user!.id,
          username: req.user!.username,
          changedFields,
        },
      );
      const normalizedTask = this.normalizeTaskResponse(task);
      res.json(normalizedTask);
      const docId =
        typeof task._id === 'object' &&
        task._id !== null &&
        'toString' in task._id
          ? (task._id as { toString(): string }).toString()
          : String(task._id ?? '');
      if (docId) {
        void this.broadcastTaskSnapshot(task, actorId, {
          previous: previousTask,
          action: 'обновлена',
        }).catch((error) => {
          console.error('Не удалось обновить сообщения задачи', error);
        });
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

  transportOptions = async (_req: RequestWithUser, res: Response) => {
    const positions = await CollectionItem.find({
      type: 'positions',
      name: { $regex: /^водитель$/i },
    })
      .select({ _id: 1 })
      .lean<{ _id: unknown }[]>();
    const positionIds = positions
      .map((item) => (item?._id ? String(item._id) : null))
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    let drivers: { telegram_id: number; name?: string; username?: string }[] =
      [];
    if (positionIds.length > 0) {
      drivers = await User.find({ positionId: { $in: positionIds } })
        .select({ telegram_id: 1, name: 1, username: 1 })
        .sort({ name: 1, telegram_id: 1 })
        .lean<{ telegram_id: number; name?: string; username?: string }[]>();
    }
    const vehicles = await FleetVehicle.find()
      .select({ name: 1, registrationNumber: 1, transportType: 1 })
      .sort({ name: 1 })
      .lean<
        {
          _id: unknown;
          name: string;
          registrationNumber: string;
          transportType?: string;
        }[]
      >();
    res.json({
      drivers: drivers.map((driver) => ({
        id: driver.telegram_id,
        name:
          (typeof driver.name === 'string' && driver.name.trim().length > 0
            ? driver.name.trim()
            : driver.username) || String(driver.telegram_id),
        username: driver.username || null,
      })),
      vehicles: vehicles.map((vehicle) => ({
        id: String(vehicle._id),
        name: vehicle.name,
        registrationNumber: vehicle.registrationNumber,
        transportType:
          typeof vehicle.transportType === 'string' &&
          vehicle.transportType.trim().length > 0
            ? vehicle.transportType
            : 'Легковой',
      })),
    });
  };

  executors = async (req: RequestWithUser, res: Response) => {
    const kindParam =
      typeof req.query.kind === 'string' ? req.query.kind.trim() : '';
    if (kindParam === 'request') {
      const admins = await User.find({})
        .select({ telegram_id: 1, name: 1, username: 1, role: 1, access: 1 })
        .lean<
          {
            telegram_id: number;
            name?: string;
            username?: string;
            role?: string;
            access?: number;
          }[]
        >();
      const list = admins
        .filter((candidate) => hasAdminAccess(candidate.role, candidate.access))
        .map((candidate) => ({
          telegram_id: candidate.telegram_id,
          name: candidate.name,
          username: candidate.username,
          telegram_username: candidate.username ?? null,
        }));
      res.json(list);
      return;
    }
    res.json([]);
  };

  private normalizeReportFilters(source: Request['query']) {
    const filters: Record<string, unknown> = { ...source };
    if (typeof filters.kind === 'string') {
      const trimmed = filters.kind.trim();
      if (trimmed === 'task' || trimmed === 'request') {
        filters.kind = trimmed;
      } else {
        delete filters.kind;
      }
    }
    if (typeof filters.from === 'string') {
      const trimmed = filters.from.trim();
      if (trimmed) {
        filters.from = trimmed;
      } else {
        delete filters.from;
      }
    }
    if (typeof filters.to === 'string') {
      const trimmed = filters.to.trim();
      if (trimmed) {
        filters.to = trimmed;
      } else {
        delete filters.to;
      }
    }
    return filters;
  }

  summary = async (req: Request, res: Response) => {
    const filters = this.normalizeReportFilters(req.query);
    res.json(await this.service.summary(filters));
  };

  chart = async (req: Request, res: Response) => {
    const filters = this.normalizeReportFilters(req.query);
    res.json(await this.service.chart(filters));
  };

  remove = async (req: RequestWithUser, res: Response) => {
    const existing = await Task.findById(req.params.id);
    const plain = existing
      ? ((typeof existing.toObject === 'function'
          ? (existing.toObject() as unknown)
          : (existing as unknown)) as TaskWithMeta & Record<string, unknown>)
      : null;
    if (!plain) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Задача не найдена',
        status: 404,
        detail: 'Not Found',
      });
      return;
    }
    const topicId = this.normalizeTopicId(plain.telegram_topic_id);
    const groupChatId = resolveGroupChatId();
    const normalizedGroupChatId = this.normalizeChatId(groupChatId);
    const photosChatId = this.normalizeChatId(plain.telegram_photos_chat_id);
    const photosTopicId = this.normalizeTopicId(plain.telegram_photos_topic_id);
    const photosMessageId = this.toMessageId(plain.telegram_photos_message_id);
    const messageTargets = new Map<
      number,
      { expected?: number; actual?: number }
    >();
    const registerMessage = (
      messageId?: number,
      expectedTopic?: number,
      actualTopic?: number,
    ) => {
      if (typeof messageId !== 'number') return;
      if (!messageTargets.has(messageId)) {
        messageTargets.set(messageId, {
          expected: expectedTopic,
          actual: actualTopic,
        });
      }
    };
    registerMessage(
      this.toMessageId(plain.telegram_message_id),
      topicId,
      topicId,
    );
    registerMessage(
      this.toMessageId(plain.telegram_history_message_id),
      topicId,
      topicId,
    );
    registerMessage(
      this.toMessageId(plain.telegram_status_message_id),
      topicId,
      topicId,
    );
    registerMessage(
      this.toMessageId(plain.telegram_summary_message_id),
      topicId,
      topicId,
    );
    registerMessage(
      this.toMessageId(plain.telegram_comment_message_id),
      topicId,
      topicId,
    );
    const cleanupMeta = plain.telegram_message_cleanup;
    if (cleanupMeta && typeof cleanupMeta === 'object') {
      const cleanupMessageId = this.toMessageId(
        (cleanupMeta as Record<string, unknown>).message_id,
      );
      const cleanupTopicId = this.normalizeTopicId(
        (cleanupMeta as Record<string, unknown>).topic_id,
      );
      const attemptedTopicId = this.normalizeTopicId(
        (cleanupMeta as Record<string, unknown>).attempted_topic_id,
      );
      registerMessage(cleanupMessageId, cleanupTopicId, attemptedTopicId);
      const newMessageId = this.toMessageId(
        (cleanupMeta as Record<string, unknown>).new_message_id,
      );
      registerMessage(newMessageId, cleanupTopicId, attemptedTopicId);
    }

    const previewIds = this.normalizeMessageIdList(
      plain.telegram_preview_message_ids,
    );
    const attachmentIds = this.normalizeMessageIdList(
      plain.telegram_attachments_message_ids,
    );
    const directMessages = this.normalizeDirectMessages(
      plain.telegram_dm_message_ids,
    );

    const attachmentsChatValue =
      photosChatId ?? groupChatId ?? normalizedGroupChatId;
    const normalizedAttachmentsChatId =
      this.normalizeChatId(attachmentsChatValue);
    const uniquePreviewIds = Array.from(new Set(previewIds));
    const uniqueAttachmentIds = Array.from(new Set(attachmentIds));
    if (normalizedAttachmentsChatId) {
      if (uniquePreviewIds.length) {
        await this.deleteAttachmentMessages(
          normalizedAttachmentsChatId,
          uniquePreviewIds,
        );
      }
      if (uniqueAttachmentIds.length) {
        await this.deleteAttachmentMessages(
          normalizedAttachmentsChatId,
          uniqueAttachmentIds,
        );
      }
    }
    if (groupChatId) {
      for (const [messageId, meta] of messageTargets.entries()) {
        await this.deleteTaskMessageSafely(
          groupChatId,
          messageId,
          meta.expected,
          meta.actual,
        );
      }
    }
    if (photosMessageId && normalizedAttachmentsChatId) {
      await this.deleteTaskMessageSafely(
        normalizedAttachmentsChatId,
        photosMessageId,
        photosTopicId,
        photosTopicId,
      );
    }

    await this.deleteDirectMessages(directMessages);

    const actorId =
      typeof req.user?.id === 'number' && Number.isFinite(req.user.id)
        ? req.user.id
        : undefined;
    const task = await this.service.remove(req.params.id, actorId);
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
