// Конфигурация каталога загрузок
// Модули: path
import path from 'path';

const resolvePositiveInteger = (
  source: string | undefined,
  fallback: number,
): number => {
  if (!source) return fallback;
  const parsed = Number.parseInt(source.trim(), 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
};

export const uploadsDir = path.resolve(
  process.env.STORAGE_DIR || path.join('apps', 'api', 'public', 'uploads'),
);

export const storageCleanupRetentionDays = resolvePositiveInteger(
  process.env.STORAGE_ORPHAN_RETENTION_DAYS,
  30,
);

export const storageCleanupCron =
  (process.env.STORAGE_CLEANUP_CRON || '30 2 * * *').trim() || '30 2 * * *';
