// Назначение файла: управление пользовательскими настройками задач и кешем
// Основные модули: db/models/CollectionItem, shared/constants
import { CollectionItem } from '../db/models/CollectionItem';
import { Task } from '../db/model';
import { TASK_TYPES } from 'shared';

type LeanCollectionItem = {
  _id: unknown;
  type: string;
  name: string;
  value: string;
  meta?: Record<string, unknown> | null;
};

type TaskFieldSettingsCache = {
  fields: Map<string, string>;
  types: Map<string, { label: string; tg_theme_url?: string; topicId?: number; chatId?: string }>;
  expiresAt: number;
};

const CACHE_TTL_MS = 30_000;
const FIELD_COLLECTION = 'task_field_labels';
const TYPE_COLLECTION = 'task_type_settings';

let cache: TaskFieldSettingsCache | null = null;

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const toLabelFromName = (name: string): string => {
  const key = name.replace(/[_\s]+/g, ' ').trim();
  if (!key) return 'Без названия';
  return key.slice(0, 1).toUpperCase() + key.slice(1);
};

const collectTaskFieldNames = (): string[] => {
  const schema = Task.schema;
  if (!schema) return [];
  const names = new Set<string>();
  const excluded = new Set(['_id', '__v', 'createdAt', 'updatedAt']);
  Object.keys(schema.paths).forEach((path) => {
    if (!path) return;
    const [first] = path.split('.');
    if (!first || excluded.has(first)) return;
    names.add(first);
  });
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'ru'));
};

const parseTelegramTopicUrl = (url: string): { chatId?: string; topicId?: number } | null => {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/i.test(parsed.protocol)) {
      return null;
    }
    const host = parsed.hostname.toLowerCase();
    if (host !== 't.me' && host !== 'telegram.me') {
      return null;
    }
    const segments = parsed.pathname.replace(/^\/+/, '').split('/');
    if (segments.length < 2) {
      return null;
    }
    if (segments[0] === 'c') {
      if (segments.length < 3) {
        return null;
      }
      const chatPart = segments[1].replace(/[^0-9]/g, '');
      const messagePart = segments[2].replace(/[^0-9]/g, '');
      if (!chatPart || !messagePart) {
        return null;
      }
      const topicId = Number.parseInt(messagePart, 10);
      if (!Number.isFinite(topicId) || topicId <= 0) {
        return null;
      }
      return { chatId: `-100${chatPart}`, topicId };
    }
    const messagePart = segments[1].replace(/[^0-9]/g, '');
    if (!messagePart) {
      return null;
    }
    const topicId = Number.parseInt(messagePart, 10);
    if (!Number.isFinite(topicId) || topicId <= 0) {
      return null;
    }
    return { topicId };
  } catch {
    return null;
  }
};

const loadCache = async (): Promise<TaskFieldSettingsCache> => {
  if (cache && cache.expiresAt > Date.now()) {
    return cache;
  }
  const [fieldItems, typeItems] = await Promise.all([
    CollectionItem.find({ type: FIELD_COLLECTION }).lean(),
    CollectionItem.find({ type: TYPE_COLLECTION }).lean(),
  ]);
  const next: TaskFieldSettingsCache = {
    fields: new Map<string, string>(),
    types: new Map<string, { label: string; tg_theme_url?: string; topicId?: number; chatId?: string }>(),
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  (fieldItems as LeanCollectionItem[]).forEach((item) => {
    const label = normalizeString(item.value);
    if (label) {
      next.fields.set(item.name, label);
    }
  });
  (typeItems as LeanCollectionItem[]).forEach((item) => {
    const label = normalizeString(item.value);
    const meta = (item.meta && typeof item.meta === 'object' ? item.meta : {}) as {
      tg_theme_url?: unknown;
      parsed_chat_id?: unknown;
      parsed_topic_id?: unknown;
    };
    const tgThemeUrl = normalizeString(meta.tg_theme_url);
    const parsedTopicId = Number(meta.parsed_topic_id);
    const topicId = Number.isFinite(parsedTopicId) ? parsedTopicId : undefined;
    const chatId = normalizeString(meta.parsed_chat_id);
    next.types.set(item.name, {
      label: label ?? item.name,
      tg_theme_url: tgThemeUrl,
      topicId,
      chatId,
    });
  });
  cache = next;
  return cache;
};

export const clearTaskSettingsCache = () => {
  cache = null;
};

export const getTaskFieldSettings = async () => {
  const [cacheData, fieldNames] = await Promise.all([
    loadCache(),
    Promise.resolve(collectTaskFieldNames()),
  ]);
  return fieldNames.map((name) => ({
    name,
    label: cacheData.fields.get(name) ?? toLabelFromName(name),
    defaultLabel: toLabelFromName(name),
  }));
};

export const getTaskTypeSettings = async () => {
  const cacheData = await loadCache();
  return TASK_TYPES.map((typeName) => {
    const existing = cacheData.types.get(typeName);
    return {
      name: typeName,
      label: existing?.label ?? typeName,
      defaultLabel: typeName,
      tg_theme_url: existing?.tg_theme_url,
      topicId: existing?.topicId,
      chatId: existing?.chatId,
    };
  });
};

export const resolveTaskTopicId = async (
  taskType: unknown,
  expectedChatId?: string | number,
): Promise<number | undefined> => {
  const typeName = normalizeString(taskType);
  if (!typeName) return undefined;
  const cacheData = await loadCache();
  const target = cacheData.types.get(typeName);
  if (!target) return undefined;
  if (expectedChatId) {
    const normalizedExpected = String(expectedChatId);
    if (target.chatId && target.chatId !== normalizedExpected) {
      return undefined;
    }
  }
  return target.topicId;
};

export const updateTaskFieldLabel = async (name: string, label: string) => {
  const trimmedName = name.trim();
  const trimmedLabel = label.trim();
  await CollectionItem.updateOne(
    { type: FIELD_COLLECTION, name: trimmedName },
    { type: FIELD_COLLECTION, name: trimmedName, value: trimmedLabel },
    { upsert: true },
  ).exec();
  clearTaskSettingsCache();
};

const buildTypeMeta = (tgThemeUrl?: string | null) => {
  const meta: Record<string, unknown> = {};
  if (!tgThemeUrl) {
    return meta;
  }
  const parsed = parseTelegramTopicUrl(tgThemeUrl);
  if (!parsed) {
    meta.tg_theme_url = tgThemeUrl;
    return meta;
  }
  meta.tg_theme_url = tgThemeUrl;
  if (parsed.chatId) {
    meta.parsed_chat_id = parsed.chatId;
  }
  if (typeof parsed.topicId === 'number') {
    meta.parsed_topic_id = parsed.topicId;
  }
  return meta;
};

export const updateTaskTypeSettings = async (
  name: string,
  label: string,
  tgThemeUrl?: string | null,
) => {
  const trimmedName = name.trim();
  const trimmedLabel = label.trim();
  const meta = buildTypeMeta(tgThemeUrl ? tgThemeUrl.trim() : tgThemeUrl);
  await CollectionItem.updateOne(
    { type: TYPE_COLLECTION, name: trimmedName },
    { type: TYPE_COLLECTION, name: trimmedName, value: trimmedLabel, meta },
    { upsert: true },
  ).exec();
  clearTaskSettingsCache();
};

export const removeTaskTypeLink = async (name: string) => {
  const trimmedName = name.trim();
  await CollectionItem.updateOne(
    { type: TYPE_COLLECTION, name: trimmedName },
    {
      $unset: { 'meta.tg_theme_url': '', 'meta.parsed_chat_id': '', 'meta.parsed_topic_id': '' },
    },
  ).exec();
  clearTaskSettingsCache();
};

export const parseTopicLink = parseTelegramTopicUrl;

export default {
  getTaskFieldSettings,
  getTaskTypeSettings,
  resolveTaskTopicId,
  updateTaskFieldLabel,
  updateTaskTypeSettings,
  removeTaskTypeLink,
  parseTopicLink,
  clearTaskSettingsCache,
};
