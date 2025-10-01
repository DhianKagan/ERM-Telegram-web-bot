// Назначение: формирование текста истории задач для Telegram
// Основные модули: db/model, db/queries, shared, utils/userLink
import { PROJECT_TIMEZONE, PROJECT_TIMEZONE_LABEL } from 'shared';
import { Task, type HistoryEntry } from '../db/model';
import { getUsersMap } from '../db/queries';
import userLink from '../utils/userLink';

const historyFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: PROJECT_TIMEZONE,
});

type UsersMap = Record<
  number,
  {
    name?: string | null;
    username?: string | null;
  }
>;

const emptyObject = Object.freeze({}) as Record<string, unknown>;

function mdEscape(str: unknown): string {
  // eslint-disable-next-line no-useless-escape
  return String(str).replace(/[\\_*\[\]()~`>#+\-=|{}!.]/g, '\\$&');
}

function resolveAuthor(entry: HistoryEntry, users: UsersMap): string {
  const id = Number(entry.changed_by);
  if (Number.isFinite(id) && id !== 0) {
    const user = users[id];
    const display = user?.name || user?.username || undefined;
    return userLink(id, display);
  }
  return mdEscape('Система');
}

const fieldNames: Record<string, string> = {
  status: 'статус',
  deadline: 'срок',
  due: 'срок',
  completed_at: 'выполнено',
  assignees: 'исполнители',
  description: 'описание',
  title: 'название',
  comment: 'комментарий',
};

const hiddenFields = new Set(['comment']);

const fieldDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

const numberFormatter = new Intl.NumberFormat('ru-RU');

function parseFixedOffset(label: string): number | null {
  const normalized = label.trim().toUpperCase();
  const match = /^(?:GMT|UTC)([+-])(\d{1,2})(?::(\d{2}))?$/.exec(normalized);
  if (!match) {
    return null;
  }
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number.parseInt(match[2], 10);
  const minutes = match[3] ? Number.parseInt(match[3], 10) : 0;
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return sign * ((hours * 60 + minutes) * 60 * 1000);
}

const fixedOffsetMs = parseFixedOffset(PROJECT_TIMEZONE_LABEL);

function applyFixedOffset(date: Date): Date {
  if (fixedOffsetMs === null) {
    return date;
  }
  return new Date(date.getTime() + fixedOffsetMs);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeForCompare(value: unknown): unknown {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed) && /\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return new Date(parsed).getTime();
    }
    return trimmed;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeForCompare(item))
      .map((item) => (typeof item === 'string' ? item.trim() : item))
      .sort((a, b) => {
        const left = typeof a === 'string' ? a : JSON.stringify(a);
        const right = typeof b === 'string' ? b : JSON.stringify(b);
        return left.localeCompare(right);
      });
  }
  if (isObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeForCompare(value[key]);
        return acc;
      }, {});
  }
  return value ?? null;
}

function formatDate(value: Date): string {
  return fieldDateFormatter.format(applyFixedOffset(value)).replace(', ', ' ');
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed)) return null;
    return new Date(parsed);
  }
  return null;
}

function formatPrimitiveValue(value: unknown): string {
  if (value === null || typeof value === 'undefined') {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'да' : 'нет';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—';
    return numberFormatter.format(value);
  }
  if (value instanceof Date) {
    return formatDate(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '—';
    const date = parseDate(trimmed);
    if (date) {
      return formatDate(date);
    }
    return trimmed;
  }
  if (Array.isArray(value)) {
    if (!value.length) return '—';
    const items = value
      .map((item) => formatPrimitiveValue(item))
      .filter((item) => item && item !== '—');
    if (!items.length) return '—';
    return items.join(', ');
  }
  if (isObject(value)) {
    const json = JSON.stringify(value);
    return json ? json : '—';
  }
  return String(value);
}

function formatFieldName(field: string): string {
  const key = field.trim();
  const mapped = fieldNames[key] ?? key.replace(/_/g, ' ');
  return mdEscape(mapped);
}

function formatFieldValue(value: unknown): string {
  const primitive = formatPrimitiveValue(value);
  const escaped = mdEscape(primitive);
  return escaped.replace(/\\\./g, '.');
}

export function describeAction(entry: HistoryEntry): string | null {
  const to = (entry.changes?.to && isObject(entry.changes?.to))
    ? (entry.changes?.to as Record<string, unknown>)
    : emptyObject;
  const from = (entry.changes?.from && isObject(entry.changes?.from))
    ? (entry.changes?.from as Record<string, unknown>)
    : emptyObject;
  const hasChanges = Object.keys(to).length > 0 || Object.keys(from).length > 0;
  if (!hasChanges) {
    return 'задача создана';
  }
  const keys = Array.from(
    new Set([...Object.keys(from), ...Object.keys(to)]),
  ).sort();
  const changedKeys = keys.filter((key) => {
    const nextValue = to[key];
    const prevValue = from[key];
    return (
      JSON.stringify(normalizeForCompare(nextValue)) !==
      JSON.stringify(normalizeForCompare(prevValue))
    );
  });
  if (!changedKeys.length) {
    return null;
  }
  if (changedKeys.some((key) => hiddenFields.has(key))) {
    return null;
  }
  if (changedKeys.every((key) => key === 'status')) {
    const fieldName = formatFieldName('status');
    const previous = formatFieldValue(from.status);
    const next = formatFieldValue(to.status);
    return `${fieldName}: «${previous}» → «${next}»`;
  }
  const describeField = (key: string): string => {
    const fieldName = formatFieldName(key);
    const previous = formatFieldValue(from[key]);
    const next = formatFieldValue(to[key]);
    return `${fieldName}: «${previous}» → «${next}»`;
  };
  if (changedKeys.length === 1) {
    return describeField(changedKeys[0]);
  }
  const described = changedKeys.map((key) => describeField(key)).filter(Boolean);
  if (described.length) {
    return described.join('; ');
  }
  return null;
}

function formatHistoryEntry(entry: HistoryEntry, users: UsersMap): string | null {
  const action = describeAction(entry);
  const at = entry.changed_at ? new Date(entry.changed_at) : new Date();
  if (Number.isNaN(at.getTime())) return null;
  const formatted = historyFormatter.format(at).replace(', ', ' ');
  const timeWithZone = `${mdEscape(formatted)} \\(${mdEscape(
    PROJECT_TIMEZONE_LABEL,
  )}\\)`;
  const author = resolveAuthor(entry, users);
  if (!action) {
    return `• ${timeWithZone} — задачу обновил ${author}`;
  }
  return `• ${timeWithZone} — ${action} — ${author}`;
}

export interface TaskHistoryMessage {
  taskId: string;
  messageId: number | null;
  topicId?: number;
  text: string;
}

export async function getTaskHistoryMessage(
  taskId: string,
): Promise<TaskHistoryMessage | null> {
  if (!taskId) return null;
  const task = await Task.findById(taskId).lean();
  if (!task) return null;
  const messageId =
    typeof task.telegram_status_message_id === 'number'
      ? task.telegram_status_message_id
      : null;
  const topicId =
    typeof task.telegram_topic_id === 'number'
      ? task.telegram_topic_id
      : undefined;
  const history = Array.isArray(task.history) ? task.history : [];
  const userIds = new Set<number>();
  history.forEach((entry) => {
    const id = Number(entry.changed_by);
    if (Number.isFinite(id) && id !== 0) {
      userIds.add(id);
    }
  });
  const usersRaw = userIds.size
    ? await getUsersMap(Array.from(userIds))
    : {};
  const users: UsersMap = {};
  Object.entries(usersRaw).forEach(([key, value]) => {
    const id = Number(key);
    if (Number.isFinite(id)) {
      users[id] = { name: value.name, username: value.username };
    }
  });
  const lines = history
    .map((entry) => formatHistoryEntry(entry, users))
    .filter((line): line is string => Boolean(line));
  const header = '*История изменений*';
  const body = lines.length ? lines.join('\n') : mdEscape('Записей нет');
  const text = lines.length ? `${header}\n${lines.join('\n')}` : `${header}\n_${body}_`;
  return { taskId, messageId, topicId, text };
}

export async function updateTaskStatusMessageId(
  taskId: string,
  messageId: number,
): Promise<void> {
  if (!taskId || !Number.isFinite(messageId)) return;
  await Task.findByIdAndUpdate(taskId, {
    telegram_status_message_id: messageId,
  }).exec();
}
