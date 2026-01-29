// Назначение файла: кеширование настроек маршрутов и вычисление темы Telegram.
// Основные модули: CollectionItem, parseTelegramTopicUrl.

import { CollectionItem } from '../db/models/CollectionItem';
import { parseTelegramTopicUrl } from '../utils/telegramTopics';

type RoutePlanSetting = {
  key: string;
  displayName: string;
  tg_theme_url?: string;
  tg_chat_id?: string;
  tg_topic_id?: number;
};

const CACHE_TTL_MS = 60_000;

let cache: {
  updatedAt: number;
  data: Map<string, RoutePlanSetting>;
} = { updatedAt: 0, data: new Map() };

const normalizeKey = (value: unknown): string => {
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
}): RoutePlanSetting | null => {
  const key = normalizeKey(doc.name);
  if (!key) {
    return null;
  }
  const displayName = normalizeKey(doc.value) || key;
  const rawUrl = doc.meta?.tg_theme_url;
  const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  const parsed = url ? parseTelegramTopicUrl(url) : null;
  return {
    key,
    displayName,
    tg_theme_url: url || undefined,
    tg_chat_id: parsed?.chatId,
    tg_topic_id: parsed?.topicId,
  };
};

const loadFromDatabase = async (): Promise<Map<string, RoutePlanSetting>> => {
  const docs = await CollectionItem.find({
    type: 'route_plan_settings',
  }).lean();
  const pairs = docs
    .map((doc) => buildSetting(doc))
    .filter((value): value is RoutePlanSetting => Boolean(value))
    .map((setting) => [setting.key, setting] as const);
  return new Map(pairs);
};

export const invalidateRoutePlanSettingsCache = (): void => {
  cache = { updatedAt: 0, data: new Map() };
};

const loadSettings = async (): Promise<Map<string, RoutePlanSetting>> => {
  const now = Date.now();
  if (now - cache.updatedAt < CACHE_TTL_MS && cache.data.size) {
    return cache.data;
  }
  const data = await loadFromDatabase();
  cache = { updatedAt: now, data };
  return data;
};

export const resolveRoutePlanSetting = async (
  key?: unknown,
): Promise<RoutePlanSetting | null> => {
  const normalizedKey = normalizeKey(key);
  const settings = await loadSettings();
  if (normalizedKey) {
    return settings.get(normalizedKey) ?? null;
  }
  if (settings.has('default')) {
    return settings.get('default') ?? null;
  }
  const iterator = settings.values();
  const first = iterator.next();
  return first.done ? null : first.value;
};

export const resolveRoutePlanTarget = async (
  key?: unknown,
): Promise<{ chatId?: string; topicId?: number } | null> => {
  const setting = await resolveRoutePlanSetting(key);
  if (!setting) {
    return null;
  }
  if (!setting.tg_chat_id && !setting.tg_topic_id) {
    return null;
  }
  return {
    chatId: setting.tg_chat_id,
    topicId: setting.tg_topic_id,
  };
};

export default {
  resolveRoutePlanSetting,
  resolveRoutePlanTarget,
  invalidateRoutePlanSettingsCache,
};
