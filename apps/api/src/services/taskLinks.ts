// Поддержка коротких ссылок задач
// Модули: shortLinks, db/model
import type { TaskDocument } from '../db/model';
import {
  ensureShortLink,
  extractSlug,
  buildShortLink,
  isShortLink,
} from './shortLinks';

const LINK_FIELDS: (keyof Partial<TaskDocument>)[] = [
  'start_location_link',
  'end_location_link',
  'google_route_url',
];

export const normalizeManagedShortLink = (value: string): string => {
  const slug = extractSlug(value);
  if (!slug) return value;
  return buildShortLink(slug);
};

export const ensureTaskLinksShort = async (
  data: Partial<TaskDocument> = {},
): Promise<void> => {
  await Promise.all(
    LINK_FIELDS.map(async (field) => {
      const raw = data[field];
      if (typeof raw !== 'string') {
        return;
      }
      const trimmed = raw.trim();
      if (!trimmed) {
        return;
      }
      if (isShortLink(trimmed)) {
        data[field] = normalizeManagedShortLink(trimmed);
        return;
      }
      try {
        const { shortUrl } = await ensureShortLink(trimmed);
        data[field] = shortUrl;
      } catch (error) {
        console.error('Не удалось сократить ссылку задачи', { field, error });
      }
    }),
  );
};
