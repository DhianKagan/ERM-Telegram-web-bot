// Сервис коротких ссылок приложения
// Модули: crypto, mongoose модели, config
import { randomBytes } from 'node:crypto';
import type { FilterQuery } from 'mongoose';
import { ShortLink, type ShortLinkDocument } from '../db/model';
import { appUrl } from '../config';

const SHORT_PATH_SEGMENT = 'l';
const SHORT_PATH_PREFIX = (() => {
  try {
    const base = new URL(appUrl);
    const normalizedPath = base.pathname.replace(/\/+$/, '');
    return `${normalizedPath}/${SHORT_PATH_SEGMENT}/`.replace(/\/+/g, '/');
  } catch {
    return '/l/';
  }
})();

export const getShortLinkPathPrefix = (): string => {
  if (SHORT_PATH_PREFIX.startsWith('/')) {
    const trimmed = SHORT_PATH_PREFIX.replace(/\/+$/, '');
    return trimmed || '/l';
  }
  const normalized =
    SHORT_PATH_PREFIX.replace(/\/+$/, '') || SHORT_PATH_SEGMENT;
  return `/${normalized}`;
};

const APP_ORIGIN = (() => {
  try {
    const parsed = new URL(appUrl);
    parsed.pathname = '/';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
})();

const SLUG_ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const isStorageReady = (): boolean => {
  try {
    return ShortLink.db?.readyState === 1;
  } catch {
    return false;
  }
};

const generateSlug = (length = 8): string => {
  const alphabetLen = SLUG_ALPHABET.length;
  const maxUnbiasedValue = Math.floor(256 / alphabetLen) * alphabetLen;
  let slug = '';
  while (slug.length < length) {
    const byte = randomBytes(1)[0];
    if (byte >= maxUnbiasedValue) {
      continue;
    }
    const value = byte % alphabetLen;
    slug += SLUG_ALPHABET[value];
  }
  return slug;
};

export const getShortLinkBase = (): string | null => {
  if (!APP_ORIGIN) return null;
  try {
    const base = new URL(APP_ORIGIN);
    base.pathname = SHORT_PATH_PREFIX;
    return base.toString();
  } catch {
    return null;
  }
};

export const buildShortLink = (slug: string): string => {
  const base = getShortLinkBase();
  if (!base) {
    return slug;
  }
  const target = new URL(base);
  const normalizedSlug = (normalizeSlug(slug) ?? slug)
    .replace(/\/+$/g, '')
    .trim();
  target.pathname = `${SHORT_PATH_PREFIX}${normalizedSlug}`;
  target.search = '';
  target.hash = '';
  return target.toString();
};

const normalizeSlug = (value: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/[^0-9a-zA-Z_-]/.test(trimmed)) {
    return null;
  }
  return trimmed;
};

export const extractSlug = (input: string): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) {
    const normalized = trimmed.replace(/^\/+/, '');
    if (normalized.startsWith(`${SHORT_PATH_SEGMENT}/`)) {
      const [, slugCandidate] = normalized.split('/');
      return normalizeSlug(slugCandidate ?? '');
    }
    return null;
  }
  try {
    const parsed = new URL(trimmed, APP_ORIGIN ?? undefined);
    if (APP_ORIGIN && parsed.origin !== new URL(APP_ORIGIN).origin) {
      return null;
    }
    const prefix = SHORT_PATH_PREFIX.replace(/\/+$/, '');
    if (!parsed.pathname.startsWith(prefix)) {
      return null;
    }
    const slugCandidate =
      parsed.pathname.slice(prefix.length).split('/')[0] ?? '';
    return normalizeSlug(slugCandidate);
  } catch {
    return null;
  }
};

export const isShortLink = (input: string): boolean =>
  extractSlug(input) !== null;

const resolveByFilter = async (
  filter: FilterQuery<ShortLinkDocument>,
): Promise<ShortLinkDocument | null> => {
  try {
    return await ShortLink.findOneAndUpdate(
      filter,
      {
        $inc: { access_count: 1 },
        $set: { last_accessed_at: new Date() },
      },
      { new: true },
    ).exec();
  } catch (error) {
    console.error('Не удалось разрешить короткую ссылку', error);
    return null;
  }
};

export const resolveShortLink = async (
  input: string,
): Promise<string | null> => {
  const slug = extractSlug(input) ?? normalizeSlug(input);
  if (!slug) return null;
  const doc = await resolveByFilter({ slug });
  return doc?.url ?? null;
};

const resolveExistingByUrl = async (
  url: string,
): Promise<ShortLinkDocument | null> => {
  try {
    return await ShortLink.findOne({ url }).exec();
  } catch (error) {
    console.error('Не удалось найти короткую ссылку по URL', error);
    return null;
  }
};

export const ensureShortLink = async (
  url: string,
): Promise<{ shortUrl: string; slug: string }> => {
  const normalized = url.trim();
  if (!normalized) {
    throw new Error('URL не должен быть пустым');
  }
  if (!isStorageReady()) {
    throw new Error('Хранилище коротких ссылок недоступно');
  }
  try {
    // Проверяем валидность URL
    const parsedUrl = new URL(normalized);
    parsedUrl.toString();
  } catch {
    throw new Error('Некорректный URL для сокращения');
  }

  const existing = await resolveExistingByUrl(normalized);
  if (existing) {
    return { slug: existing.slug, shortUrl: buildShortLink(existing.slug) };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = generateSlug();
    try {
      const doc = await ShortLink.create({ slug, url: normalized });
      return { slug: doc.slug, shortUrl: buildShortLink(doc.slug) };
    } catch (error) {
      const mongoError = error as {
        code?: number;
        keyPattern?: Record<string, unknown>;
      };
      if (mongoError?.code === 11000) {
        if (mongoError.keyPattern?.url) {
          const duplicate = await resolveExistingByUrl(normalized);
          if (duplicate) {
            return {
              slug: duplicate.slug,
              shortUrl: buildShortLink(duplicate.slug),
            };
          }
        }
        continue;
      }
      console.error('Не удалось создать короткую ссылку', error);
      throw error;
    }
  }

  throw new Error('Не удалось создать уникальную короткую ссылку');
};

export const resolveShortLinkBySlug = async (
  slug: string,
): Promise<string | null> => {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  const doc = await resolveByFilter({ slug: normalized });
  return doc?.url ?? null;
};
