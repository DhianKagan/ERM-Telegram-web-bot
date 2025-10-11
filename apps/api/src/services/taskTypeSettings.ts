// Назначение файла: кеширование настроек типов задач и вычисление тем Telegram.
// Основные модули: CollectionItem, parseTelegramTopicUrl.

import { CollectionItem } from '../db/models/CollectionItem';
import { parseTelegramTopicUrl } from '../utils/telegramTopics';

type TaskTypeSetting = {
  type: string;
  displayName: string;
  tg_theme_url?: string;
  tg_chat_id?: string;
  tg_topic_id?: number;
  tg_photos_url?: string;
  tg_photos_chat_id?: string;
  tg_photos_topic_id?: number;
};

const CACHE_TTL_MS = 60_000;

let cache: {
  updatedAt: number;
  data: Map<string, TaskTypeSetting>;
} = { updatedAt: 0, data: new Map() };

const normalizeTypeName = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  return trimmed;
};

const buildSetting = (doc: {
  name?: unknown;
  value?: unknown;
  meta?: Record<string, unknown>;
}): TaskTypeSetting | null => {
  const type = normalizeTypeName(doc.name);
  if (!type) {
    return null;
  }
  const displayName = normalizeTypeName(doc.value) || type;
  const rawUrl = doc.meta?.tg_theme_url;
  const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  const parsed = url ? parseTelegramTopicUrl(url) : null;
  const rawPhotosUrl = doc.meta?.tg_photos_url;
  const photosUrl = typeof rawPhotosUrl === 'string' ? rawPhotosUrl.trim() : '';
  const photosParsed = photosUrl ? parseTelegramTopicUrl(photosUrl) : null;
  return {
    type,
    displayName,
    tg_theme_url: url || undefined,
    tg_chat_id: parsed?.chatId,
    tg_topic_id: parsed?.topicId,
    tg_photos_url: photosUrl || undefined,
    tg_photos_chat_id: photosParsed?.chatId,
    tg_photos_topic_id: photosParsed?.topicId,
  };
};

const loadFromDatabase = async (): Promise<Map<string, TaskTypeSetting>> => {
  const docs = await CollectionItem.find({ type: 'task_types' }).lean();
  const pairs = docs
    .map((doc) => buildSetting(doc))
    .filter((value): value is TaskTypeSetting => Boolean(value))
    .map((setting) => [setting.type, setting] as const);
  return new Map(pairs);
};

export const invalidateTaskTypeSettingsCache = (): void => {
  cache = { updatedAt: 0, data: new Map() };
};

const loadSettings = async (): Promise<Map<string, TaskTypeSetting>> => {
  const now = Date.now();
  if (now - cache.updatedAt < CACHE_TTL_MS && cache.data.size) {
    return cache.data;
  }
  const data = await loadFromDatabase();
  cache = { updatedAt: now, data };
  return data;
};

export const resolveTaskTypeSetting = async (
  taskType: unknown,
): Promise<TaskTypeSetting | null> => {
  const type = normalizeTypeName(taskType);
  if (!type) {
    return null;
  }
  const settings = await loadSettings();
  return settings.get(type) ?? null;
};

export const resolveTaskTypeTopicId = async (
  taskType: unknown,
): Promise<number | undefined> => {
  const setting = await resolveTaskTypeSetting(taskType);
  return setting?.tg_topic_id;
};

export const resolveTaskTypePhotosTarget = async (
  taskType: unknown,
): Promise<{ chatId?: string; topicId?: number } | null> => {
  const setting = await resolveTaskTypeSetting(taskType);
  if (!setting) {
    return null;
  }
  if (!setting.tg_photos_chat_id && !setting.tg_photos_topic_id) {
    return null;
  }
  return {
    chatId: setting.tg_photos_chat_id,
    topicId: setting.tg_photos_topic_id,
  };
};

export default {
  resolveTaskTypeSetting,
  resolveTaskTypeTopicId,
  resolveTaskTypePhotosTarget,
  invalidateTaskTypeSettingsCache,
};
