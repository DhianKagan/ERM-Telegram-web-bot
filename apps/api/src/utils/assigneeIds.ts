// Назначение: нормализация идентификаторов исполнителей задач
// Основные модули: отсутствуют
const NESTED_ID_KEYS = ['telegram_id', 'user_id', 'id'] as const;

type NestedIdKey = (typeof NESTED_ID_KEYS)[number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const tryNormalizeFromRecord = (
  record: Record<string, unknown>,
): number | null => {
  for (const key of NESTED_ID_KEYS) {
    if (key in record) {
      const nested = normalizeUserId(record[key as NestedIdKey]);
      if (nested !== null) {
        return nested;
      }
    }
  }
  return null;
};

export function normalizeUserId(value: unknown): number | null {
  if (isRecord(value)) {
    const nested = tryNormalizeFromRecord(value);
    if (nested !== null) {
      return nested;
    }
  }
  const source = typeof value === 'string' ? value.trim() : value;
  const numeric = Number(source);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return null;
  }
  return numeric;
}

export function collectAssigneeIds(source: unknown): number[] {
  if (!Array.isArray(source)) {
    return [];
  }
  const ids = new Set<number>();
  for (const entry of source) {
    if (entry == null) {
      continue;
    }
    if (isRecord(entry)) {
      const nested = tryNormalizeFromRecord(entry);
      if (nested !== null) {
        ids.add(nested);
        continue;
      }
    }
    const normalized = normalizeUserId(entry);
    if (normalized !== null) {
      ids.add(normalized);
    }
  }
  return Array.from(ids);
}
