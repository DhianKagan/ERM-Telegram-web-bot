// Утилиты для работы со вложениями задач
// Основные модули: json5, mongoose, db/model
import JSON5 from 'json5';
import { Types } from 'mongoose';
import type { Attachment } from '../db/model';
import {
  buildAttachmentsFromCommentHtml as buildSharedAttachmentsFromCommentHtml,
  extractFileIdFromUrl as extractFileIdFromUrlShared,
} from 'shared';

const jsonParsers = [
  JSON.parse,
  JSON5.parse,
];

const isPlainObject = (
  value: unknown,
): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const toDate = (value: unknown): Date | undefined => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return undefined;
};

const normalizeAttachmentRecord = (
  input: Record<string, unknown>,
): Attachment | null => {
  const urlRaw = typeof input.url === 'string' ? input.url.trim() : '';
  if (!urlRaw) {
    return null;
  }
  const nameRaw = input.name;
  const name =
    typeof nameRaw === 'string' && nameRaw.trim()
      ? nameRaw.trim()
      : urlRaw.split('/').pop() || urlRaw;
  const thumbnailUrl =
    typeof input.thumbnailUrl === 'string' && input.thumbnailUrl.trim()
      ? input.thumbnailUrl
      : undefined;
  const uploadedBy = toNumber(input.uploadedBy);
  const uploadedAt = toDate(input.uploadedAt);
  const type =
    typeof input.type === 'string' && input.type.trim()
      ? input.type
      : 'application/octet-stream';
  const size = toNumber(input.size);

  const normalized: Attachment = {
    name,
    url: urlRaw,
    thumbnailUrl,
    uploadedBy,
    uploadedAt,
    type,
    size,
  } as Attachment;

  return normalized;
};

function parseAttachmentLike(value: unknown): Attachment[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    for (const parse of jsonParsers) {
      try {
        const parsed = parse(trimmed);
        const result = parseAttachmentLike(parsed);
        if (result) {
          return result;
        }
      } catch {
        // пробуем следующий парсер
      }
    }
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .filter(isPlainObject)
      .map((item) => normalizeAttachmentRecord(item))
      .filter((item): item is Attachment => item !== null);
  }
  if (isPlainObject(value)) {
    const single = normalizeAttachmentRecord(value);
    return single ? [single] : [];
  }
  return [];
}

export function coerceAttachments(
  value: unknown,
): Attachment[] | undefined {
  return parseAttachmentLike(value);
}

export const extractFileIdFromUrl = (
  url: string | null | undefined,
): string | null => extractFileIdFromUrlShared(url);

export const buildAttachmentsFromCommentHtml = (
  commentHtml: string | null | undefined,
  options: { existing?: Attachment[] | null } = {},
): Attachment[] =>
  buildSharedAttachmentsFromCommentHtml<Attachment>(commentHtml, {
    existing: options.existing,
    createPlaceholder: (_fileId, url) =>
      ({
        name: '',
        url,
        thumbnailUrl: undefined,
        uploadedBy: undefined as unknown as number,
        uploadedAt: undefined as unknown as Date,
        type: 'application/octet-stream',
        size: 0,
      } as Attachment),
  });

/**
 * Извлекает ObjectId файлов из массива вложений задачи.
 * Допускает URL вида `/api/v1/files/<id>` с дополнительными параметрами.
 */
export function extractAttachmentIds(
  attachments: Attachment[] | undefined | null,
): Types.ObjectId[] {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return [];
  }
  const result: Types.ObjectId[] = [];
  const seen = new Set<string>();
  attachments.forEach((attachment) => {
    if (!attachment || typeof attachment.url !== 'string') return;
    const fileId = extractFileIdFromUrlShared(attachment.url);
    if (!fileId || !Types.ObjectId.isValid(fileId)) return;
    const key = fileId.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(new Types.ObjectId(fileId));
  });
  return result;
}
