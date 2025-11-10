// Лимиты вложений на пользователя
// Модули: none

const parsePositiveNumber = (
  source: string | undefined,
  fallback: number,
): number => {
  if (!source) return fallback;
  const trimmed = source.trim();
  if (!trimmed) return fallback;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

export const maxUserFiles = parsePositiveNumber(
  process.env.USER_FILES_MAX_COUNT,
  20,
);

export const maxUserStorage = parsePositiveNumber(
  process.env.USER_FILES_MAX_SIZE,
  50 * 1024 * 1024,
);

export const staleUserFilesGraceMinutes = parsePositiveNumber(
  process.env.USER_FILES_STALE_GRACE_MINUTES,
  60,
);
