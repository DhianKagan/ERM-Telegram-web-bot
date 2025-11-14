// Утилиты для работы со вложениями задач
// Основные модули: json5, mongoose, db/model
import JSON5 from 'json5';
import { Types } from 'mongoose';
import type { Attachment } from '../db/model';

const jsonParsers = [JSON.parse, JSON5.parse];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
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

export function coerceAttachments(value: unknown): Attachment[] | undefined {
  return parseAttachmentLike(value);
}

const htmlEntityDecode = (value: string): string =>
  value
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&');

const OBJECT_ID_LENGTH = 24;

const normalizeObjectIdCandidate = (candidate: string): string | null => {
  const trimmed = candidate.trim();
  if (trimmed.length !== OBJECT_ID_LENGTH) {
    return null;
  }
  if (!Types.ObjectId.isValid(trimmed)) {
    return null;
  }
  return trimmed.toLowerCase();
};

const collectObjectIds = (source: string): Set<string> => {
  const result = new Set<string>();
  const hexPattern = /[0-9a-fA-F]{24}/g;
  let match: RegExpExecArray | null;
  while ((match = hexPattern.exec(source)) !== null) {
    const normalized = normalizeObjectIdCandidate(match[0]);
    if (normalized) {
      result.add(normalized);
    }
  }
  return result;
};

const collectIdsFromAttribute = (value: string): Set<string> => {
  const decoded = htmlEntityDecode(value);
  const tokens = decoded
    .split(/[,;\s]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  const result = new Set<string>();
  tokens.forEach((token) => {
    const normalized = normalizeObjectIdCandidate(token);
    if (normalized) {
      result.add(normalized);
    }
  });
  return result;
};

const extractIdsFromCommentHtml = (html: string): string[] => {
  if (!html.trim()) {
    return [];
  }
  const decoded = htmlEntityDecode(html);
  const ids = new Set<string>();
  const urlPattern = /\/api\/v1\/files\/([0-9a-fA-F]{24})/g;
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(decoded)) !== null) {
    const normalized = normalizeObjectIdCandidate(match[1] ?? '');
    if (normalized) {
      ids.add(normalized);
    }
  }
  const attributePattern = /data-(?:file|attachment)(?:-ids?)?=(["'])(.*?)\1/gi;
  while ((match = attributePattern.exec(decoded)) !== null) {
    const attributeIds = collectIdsFromAttribute(match[2] ?? '');
    attributeIds.forEach((id) => ids.add(id));
  }
  if (ids.size === 0) {
    const fallback = collectObjectIds(decoded);
    fallback.forEach((id) => ids.add(id));
  }
  return Array.from(ids.values());
};

export const extractFileIdFromUrl = (
  url: string | null | undefined,
): string | null => {
  if (typeof url !== 'string') {
    return null;
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  const [withoutFragment] = trimmed.split('#');
  const [pathPart] = withoutFragment.split('?');
  if (!pathPart) {
    return null;
  }
  const segments = pathPart.split('/').filter(Boolean);
  if (segments.length === 0) {
    return null;
  }
  const last = segments[segments.length - 1];
  const normalized = normalizeObjectIdCandidate(last);
  return normalized ?? null;
};

export const buildAttachmentsFromCommentHtml = (
  commentHtml: string | null | undefined,
  options: { existing?: Attachment[] | null } = {},
): Attachment[] => {
  const existing: Attachment[] = Array.isArray(options.existing)
    ? options.existing
        .filter((candidate): candidate is Attachment =>
          Boolean(candidate && typeof candidate.url === 'string'),
        )
        .map((candidate) => ({ ...candidate }))
    : [];
  const seenFileIds = new Set<string>();
  const seenUrls = new Set<string>();
  existing.forEach((attachment) => {
    const url = typeof attachment.url === 'string' ? attachment.url.trim() : '';
    if (url) {
      seenUrls.add(url);
    }
    const fileId = extractFileIdFromUrl(url);
    if (fileId) {
      seenFileIds.add(fileId);
    }
  });
  const source = typeof commentHtml === 'string' ? commentHtml : '';
  const ids = extractIdsFromCommentHtml(source);
  ids.forEach((id) => {
    if (seenFileIds.has(id)) {
      return;
    }
    const url = `/api/v1/files/${id}`;
    if (seenUrls.has(url)) {
      return;
    }
    seenFileIds.add(id);
    seenUrls.add(url);
    existing.push({
      name: '',
      url,
      uploadedBy: undefined as unknown as number,
      uploadedAt: undefined as unknown as Date,
      type: undefined as unknown as string,
      size: undefined as unknown as number,
    } as Attachment);
  });
  return existing;
};

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
    const trimmed = attachment.url.trim();
    if (!trimmed) return;
    const [withoutFragment] = trimmed.split('#');
    const [pathPart] = withoutFragment.split('?');
    if (!pathPart) return;
    const segments = pathPart.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last || !Types.ObjectId.isValid(last)) return;
    const key = last.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(new Types.ObjectId(last));
  });
  return result;
}
