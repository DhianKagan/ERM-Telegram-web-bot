// Назначение: единый набор значков для статусов задач
// Основные модули: shared

import type { Task } from 'shared';

type TaskStatus = Task['status'];

export const TASK_STATUS_ICON_MAP: Record<TaskStatus, string> = {
  Новая: '🆕',
  'В работе': '🟢',
  Выполнена: '✅',
  Отменена: '⛔️',
};

export const getTaskStatusIcon = (
  status: TaskStatus | undefined | null,
): string | null => {
  if (!status) {
    return null;
  }
  return TASK_STATUS_ICON_MAP[status] ?? null;
};
