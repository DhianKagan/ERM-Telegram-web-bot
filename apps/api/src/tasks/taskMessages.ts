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

type UserProfile = { name?: string | null; username?: string | null };

const formatAuthorText = (
  profile: UserProfile | undefined,
  userId: number,
): string => {
  if (!profile) {
    return `пользователем #${userId}`;
  }
  const name = profile.name?.trim();
  if (name) {
    return `пользователем ${name}`;
  }
  const username = profile.username?.trim();
  if (username) {
    return `пользователем ${username}`;
  }
  return `пользователем #${userId}`;
};

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
    const candidate = String(
      (value as { toString(): unknown }).toString() ?? '',
    );
    return candidate.trim() ? candidate.trim() : null;
  }
  return null;
};

const extractStatus = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  return trimString(record.status);
};

type TaskIdentifierSource = Partial<
  Pick<TaskDocument, '_id' | 'request_id' | 'task_number'>
> &
  Record<string, unknown>;

export function getTaskIdentifier(task: TaskIdentifierSource): string {
  return (
    resolveIdentifier(task.request_id) ||
    resolveIdentifier(task.task_number) ||
    resolveIdentifier(task._id) ||
    ''
  );
}

export async function buildActionMessage(
  task: TaskIdentifierSource,
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
      authorText = formatAuthorText(profile, creator);
    } catch (error) {
      console.error('Не удалось получить автора задачи', error);
      authorText = `пользователем #${creator}`;
    }
  }
  return `Задача ${identifier} ${action} ${authorText} ${formatted} (${PROJECT_TIMEZONE_LABEL})`;
}

const resolveHistoryAction = (
  entry: HistoryEntry | undefined,
): string | null => {
  if (!entry) return null;
  const toStatus = extractStatus(entry.changes?.to);
  const fromStatus = extractStatus(entry.changes?.from);
  if (toStatus && toStatus !== fromStatus) {
    return `переведена в статус «${toStatus}»`;
  }
  if (!toStatus && fromStatus && fromStatus !== toStatus) {
    return 'переведена в статус «без статуса»';
  }
  return null;
};

const shouldSkipInitialStatusEntry = (
  entries: HistoryEntry[],
  index: number,
): boolean => {
  if (index !== 0) {
    return false;
  }
  const entry = entries[index];
  if (!entry) {
    return false;
  }
  const toStatus = extractStatus(entry.changes?.to);
  if (!toStatus) {
    return false;
  }
  const fromStatus = extractStatus(entry.changes?.from);
  return !fromStatus;
};

export async function buildLatestHistorySummary(
  task: TaskIdentifierSource & { history?: HistoryEntry[] } & Record<
      string,
      unknown
    >,
): Promise<string | null> {
  const history = Array.isArray(task.history) ? task.history : [];
  if (!history.length) {
    return null;
  }
  const latest = history[history.length - 1];
  if (shouldSkipInitialStatusEntry(history, history.length - 1)) {
    return null;
  }
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

export async function buildHistorySummaryLog(
  task: TaskIdentifierSource & { history?: HistoryEntry[] } & Record<
      string,
      unknown
    >,
): Promise<string | null> {
  const history = Array.isArray(task.history) ? task.history : [];
  if (!history.length) {
    return null;
  }
  const identifier = getTaskIdentifier(task);
  const userIds = new Set<number>();
  history.forEach((entry) => {
    const changedBy = Number(entry.changed_by);
    if (Number.isFinite(changedBy) && changedBy !== 0) {
      userIds.add(changedBy);
    }
  });
  let userProfiles: Record<number, UserProfile> = {};
  if (userIds.size) {
    try {
      const users = await getUsersMap(Array.from(userIds));
      Object.entries(users || {}).forEach(([key, value]) => {
        const numericId = Number(key);
        if (Number.isFinite(numericId)) {
          userProfiles[numericId] = {
            name: value?.name,
            username: value?.username,
          };
        }
      });
    } catch (error) {
      console.error('Не удалось получить авторов истории задачи', error);
    }
  }
  const lines = history
    .map((entry, index) => {
      if (shouldSkipInitialStatusEntry(history, index)) {
        return null;
      }
      const action = resolveHistoryAction(entry);
      if (!action) {
        return null;
      }
      const changedAt =
        entry.changed_at instanceof Date
          ? entry.changed_at
          : entry.changed_at
            ? new Date(entry.changed_at)
            : new Date();
      if (Number.isNaN(changedAt.getTime())) {
        return null;
      }
      const formatted = taskEventFormatter.format(changedAt).replace(', ', ' ');
      const changedBy = Number(entry.changed_by);
      let authorText = 'неизвестным пользователем';
      if (Number.isFinite(changedBy) && changedBy !== 0) {
        authorText = formatAuthorText(userProfiles[changedBy], changedBy);
      }
      return `Задача ${identifier} ${action} ${authorText} ${formatted} (${PROJECT_TIMEZONE_LABEL})`;
    })
    .filter((line): line is string => Boolean(line));
  if (!lines.length) {
    return null;
  }
  return lines.join('\n');
}
