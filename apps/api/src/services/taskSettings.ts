// Назначение файла: управление настройками задач (подписи полей и темы Telegram).
// Основные модули: mongoose модели CollectionItem и Task, shared constants.
import { FilterQuery } from 'mongoose';
import { taskFields, TASK_TYPES } from 'shared';
import {
  CollectionItem,
  type CollectionItemDocument,
} from '../db/models/CollectionItem';
import { Task } from '../db/model';

const TASK_FIELD_LABELS_TYPE = 'task_field_labels';
const TASK_TYPE_TOPICS_TYPE = 'task_type_topics';

export interface TaskFieldSetting {
  name: string;
  label: string;
  defaultLabel: string;
}

export interface TaskTypeSetting {
  taskType: string;
  tg_theme_url: string | null;
  chatId?: string;
  topicId?: number;
}

const TELEGRAM_TOPIC_HOSTS = new Set(['t.me', 'telegram.me']);

const topicUrlRegexp = /\/c\/([0-9]{5,})\/([0-9]+)/i;

const sanitizeLabel = (value: string): string => value.trim();

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const getTaskFieldSettings = async (): Promise<TaskFieldSetting[]> => {
  const stored = await CollectionItem.find({
    type: TASK_FIELD_LABELS_TYPE,
  })
    .lean()
    .exec();
  const byName = new Map<string, string>();
  stored.forEach((item) => {
    if (typeof item.name === 'string' && typeof item.value === 'string') {
      const label = sanitizeLabel(item.value);
      if (label) {
        byName.set(item.name, label);
      }
    }
  });

  return taskFields.map((field) => ({
    name: field.name,
    label: byName.get(field.name) ?? field.label,
    defaultLabel: field.label,
  }));
};

export const setTaskFieldLabel = async (
  name: string,
  label: string,
): Promise<CollectionItemDocument> => {
  const trimmed = sanitizeLabel(label);
  if (!trimmed) {
    throw new Error('Название поля не может быть пустым');
  }
  return CollectionItem.findOneAndUpdate(
    { type: TASK_FIELD_LABELS_TYPE, name },
    { $set: { value: trimmed } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).exec();
};

type TopicMeta = {
  tg_chat_id?: string;
  tg_topic_id?: number;
};

const parseTelegramTopicUrl = (
  value: string,
): { chatId: string; topicId: number } => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Некорректная ссылка на тему Telegram');
  }
  if (!TELEGRAM_TOPIC_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error('Ссылка должна вести на t.me или telegram.me');
  }
  const match = parsed.pathname.match(topicUrlRegexp);
  if (!match) {
    throw new Error('Ссылка должна содержать идентификатор темы вида /c/<id>/<topic>');
  }
  const [internalChatIdRaw, topicIdRaw] = match.slice(1);
  if (!internalChatIdRaw || !topicIdRaw) {
    throw new Error('Не удалось определить тему из ссылки');
  }
  const topicId = Number(topicIdRaw);
  if (!Number.isFinite(topicId) || topicId <= 0) {
    throw new Error('Идентификатор темы должен быть положительным числом');
  }
  const chatId = `-100${internalChatIdRaw}`;
  return { chatId, topicId };
};

const mapTaskTypeDoc = (
  type: string,
  doc?: {
    value?: unknown;
    meta?: TopicMeta;
  },
): TaskTypeSetting => {
  const tg_theme_url =
    typeof doc?.value === 'string' && doc.value.trim().length
      ? doc.value.trim()
      : null;
  const meta = doc?.meta ?? {};
  const chatId =
    typeof meta.tg_chat_id === 'string' && meta.tg_chat_id.trim().length
      ? meta.tg_chat_id.trim()
      : undefined;
  const topicId = isFiniteNumber(meta.tg_topic_id)
    ? meta.tg_topic_id
    : undefined;
  return { taskType: type, tg_theme_url, chatId, topicId };
};

export const getTaskTypeSettings = async (): Promise<TaskTypeSetting[]> => {
  const stored = await CollectionItem.find({
    type: TASK_TYPE_TOPICS_TYPE,
  })
    .lean()
    .exec();
  const byName = new Map<string, { value?: unknown; meta?: TopicMeta }>();
  stored.forEach((item) => {
    byName.set(item.name, { value: item.value, meta: item.meta as TopicMeta });
  });
  return TASK_TYPES.map((type) => mapTaskTypeDoc(type, byName.get(type)));
};

export const resolveTaskTypeTopicId = async (
  taskType: string,
): Promise<number | undefined> => {
  const doc = await CollectionItem.findOne({
    type: TASK_TYPE_TOPICS_TYPE,
    name: taskType,
  })
    .lean()
    .exec();
  const meta = doc?.meta as TopicMeta | undefined;
  return isFiniteNumber(meta?.tg_topic_id) ? meta?.tg_topic_id : undefined;
};

export const setTaskTypeTheme = async (
  taskType: string,
  url: string | null,
): Promise<TaskTypeSetting> => {
  const filter: FilterQuery<CollectionItemDocument> = {
    type: TASK_TYPE_TOPICS_TYPE,
    name: taskType,
  };
  if (!url || !url.trim()) {
    await CollectionItem.findOneAndDelete(filter).exec();
    await Task.updateMany({ task_type: taskType }, { $unset: { telegram_topic_id: '' } }).exec();
    return mapTaskTypeDoc(taskType);
  }
  const { chatId, topicId } = parseTelegramTopicUrl(url.trim());
  const doc = await CollectionItem.findOneAndUpdate(
    filter,
    {
      $set: {
        value: url.trim(),
        meta: { tg_chat_id: chatId, tg_topic_id: topicId },
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).exec();
  await Task.updateMany(
    { task_type: taskType },
    { $set: { telegram_topic_id: topicId } },
  ).exec();
  return mapTaskTypeDoc(taskType, {
    value: doc?.value,
    meta: (doc?.meta as TopicMeta | undefined) ?? {
      tg_chat_id: chatId,
      tg_topic_id: topicId,
    },
  });
};

export default {
  getTaskFieldSettings,
  setTaskFieldLabel,
  getTaskTypeSettings,
  setTaskTypeTheme,
  resolveTaskTypeTopicId,
};
