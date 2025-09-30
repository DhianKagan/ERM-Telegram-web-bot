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
  return String(str).replace(/[\\_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');
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

function describeAction(entry: HistoryEntry): string | null {
  const changes = entry.changes?.to || emptyObject;
  const hasChanges =
    changes && typeof changes === 'object' && Object.keys(changes).length > 0;
  if (!hasChanges) {
    const prev = entry.changes?.from || emptyObject;
    if (prev && Object.keys(prev).length === 0) {
      return 'задача создана';
    }
    return null;
  }
  const status = (changes as Record<string, unknown>).status;
  if (typeof status === 'string' && status.trim()) {
    return `статус изменён на «${mdEscape(status.trim())}»`;
  }
  const fields = Object.keys(changes as Record<string, unknown>);
  if (!fields.length) return null;
  const formatted = fields
    .map((field) => `«${mdEscape(field)}»`)
    .join(', ');
  return `изменены поля ${formatted}`;
}

function formatHistoryEntry(entry: HistoryEntry, users: UsersMap): string | null {
  const action = describeAction(entry);
  if (!action) return null;
  const at = entry.changed_at ? new Date(entry.changed_at) : new Date();
  if (Number.isNaN(at.getTime())) return null;
  const formatted = historyFormatter.format(at).replace(', ', ' ');
  const timeWithZone = `${mdEscape(formatted)} \\(${mdEscape(
    PROJECT_TIMEZONE_LABEL,
  )}\\)`;
  const author = resolveAuthor(entry, users);
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
