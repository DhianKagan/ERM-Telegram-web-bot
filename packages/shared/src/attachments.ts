// Назначение: общие утилиты для работы со вложениями.
// Основные модули: отсутствуют

export type AttachmentCandidate = {
  url: string;
  name?: string | null;
  thumbnailUrl?: string | null;
  uploadedBy?: number | null;
  uploadedAt?: Date | string | null;
  type?: string | null;
  size?: number | null;
};

type AttachmentPlaceholderFactory<T extends AttachmentCandidate> = (
  fileId: string,
  url: string,
) => T;

const DEFAULT_PLACEHOLDER = <T extends AttachmentCandidate>(
  _fileId: string,
  url: string,
): T =>
  ({
    url,
    name: '',
    type: 'application/octet-stream',
    size: 0,
  } as T);

const htmlEntityDecode = (value: string): string =>
  value
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&');

const OBJECT_ID_LENGTH = 24;
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export const normalizeObjectIdCandidate = (candidate: string): string | null => {
  const trimmed = candidate.trim();
  if (trimmed.length !== OBJECT_ID_LENGTH) {
    return null;
  }
  if (!OBJECT_ID_PATTERN.test(trimmed)) {
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
    .split(/[ ,;\s]+/)
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

export const extractIdsFromCommentHtml = (
  html: string | null | undefined,
): string[] => {
  const source = typeof html === 'string' ? html : '';
  if (!source.trim()) {
    return [];
  }
  const decoded = htmlEntityDecode(source);
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

export const buildAttachmentsFromCommentHtml = <T extends AttachmentCandidate>(
  commentHtml: string | null | undefined,
  options: {
    existing?: T[] | null;
    createPlaceholder?: AttachmentPlaceholderFactory<T>;
  } = {},
): T[] => {
  const existing: T[] = Array.isArray(options.existing)
    ? options.existing
        .filter(
          (candidate): candidate is T =>
            Boolean(candidate && typeof candidate.url === 'string'),
        )
        .map((candidate) => ({ ...candidate }))
    : [];
  const placeholderFactory =
    options.createPlaceholder ?? DEFAULT_PLACEHOLDER<T>;
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
    existing.push(placeholderFactory(id, url));
  });
  return existing;
};
