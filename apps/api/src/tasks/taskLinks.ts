// Назначение: построение ссылок на задачи для перехода из Telegram в веб-интерфейс
// Основные модули: config
import { appUrl } from '../config';

const APP_URL_BASE = (appUrl || '').replace(/\/+$/, '');

const toTaskIdentifier = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim();
    return normalized ? normalized : null;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toString' in value &&
    typeof (value as { toString(): unknown }).toString === 'function'
  ) {
    return toTaskIdentifier((value as { toString(): unknown }).toString());
  }
  return null;
};

export const buildTaskAppLink = (
  task: Record<string, unknown>,
): string | null => {
  if (!APP_URL_BASE) {
    return null;
  }
  const canonicalId =
    toTaskIdentifier(task._id) ??
    toTaskIdentifier(task.request_id) ??
    toTaskIdentifier(task.task_number);
  if (!canonicalId) {
    return null;
  }
  return `${APP_URL_BASE}/tasks?task=${encodeURIComponent(canonicalId)}`;
};
