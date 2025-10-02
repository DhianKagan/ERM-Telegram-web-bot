// Назначение: функции формирования текстов для уведомлений о задачах
// Основные модули: shared, db/model, db/queries
import { PROJECT_TIMEZONE, PROJECT_TIMEZONE_LABEL } from 'shared';
import type { HistoryEntry, TaskDocument } from '../db/model';
import { getUsersMap } from '../db/queries';

const taskEventFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: PROJECT_TIMEZONE,
});

const trimString = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str ? str : null;
};

const resolveIdentifier = (value: unknown): string | null => {
  if (typeof value === 'string' || typeof value === 'number') {
    return trimString(value);
  }
  if (value && typeof value === 'object' && 'toString' in value) {
    const candidate = String((value as { toString(): unknown }).toString() ?? '');
    return candidate.trim() ? candidate.trim() : null;
  }
  return null;
};

export function getTaskIdentifier(task: Partial<TaskDocument>): string {
  return (
    resolveIdentifier(task.request_id) ||
    resolveIdentifier(task.task_number) ||
    resolveIdentifier(task._id) ||
    ''
  );
}

export async function buildActionMessage(
  task: Partial<TaskDocument>,
  action: string,
  at: Date,
  creatorId?: number,
): Promise<string> {
  const identifier = getTaskIdentifier(task);
  const formatted = taskEventFormatter.format(at).replace(', ', ' ');
  const creator = Number(creatorId);
  let authorText = 'неизвестным пользователем';
  if (Number.isFinite(creator) && creator !== 0) {
    try {
      const users = await getUsersMap([creator]);
      const profile = users?.[creator];
      const name = profile?.name?.trim();
      const username = profile?.username?.trim();
      if (name) {
        authorText = `пользователем ${name}`;
      } else if (username) {
        authorText = `пользователем ${username}`;
      } else {
        authorText = `пользователем #${creator}`;
      }
    } catch (error) {
      console.error('Не удалось получить автора задачи', error);
      authorText = `пользователем #${creator}`;
    }
  }
  return `Задача ${identifier} ${action} ${authorText} ${formatted} (${PROJECT_TIMEZONE_LABEL})`;
}

const resolveHistoryAction = (entry: HistoryEntry | undefined): string | null => {
  if (!entry) return null;
  const to = entry.changes?.to ?? {};
  const from = entry.changes?.from ?? {};
  const toStatus = trimString((to as Record<string, unknown>).status);
  const fromStatus = trimString((from as Record<string, unknown>).status);
  if (toStatus && toStatus !== fromStatus) {
    return `переведена в статус «${toStatus}»`;
  }
  return 'обновлена';
};

export async function buildLatestHistorySummary(
  task: Partial<TaskDocument> & { history?: HistoryEntry[] } & Record<string, unknown>,
): Promise<string | null> {
  const history = Array.isArray(task.history) ? task.history : [];
  if (!history.length) {
    return null;
  }
  const latest = history[history.length - 1];
  const action = resolveHistoryAction(latest);
  if (!action) {
    return null;
  }
  const changedAt =
    latest.changed_at instanceof Date
      ? latest.changed_at
      : latest.changed_at
      ? new Date(latest.changed_at)
      : new Date();
  if (Number.isNaN(changedAt.getTime())) {
    return null;
  }
  const changedBy = Number(latest.changed_by);
  return buildActionMessage(
    task,
    action,
    changedAt,
    Number.isFinite(changedBy) ? changedBy : undefined,
  );
}
