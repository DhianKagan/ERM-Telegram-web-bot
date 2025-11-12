// Назначение: нормализация идентификаторов задач в строковое представление
// Основные модули: отсутствуют
export function coerceTaskId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim();
    if (!normalized) return null;
    if (normalized === '[object Object]' || normalized === 'undefined') {
      return null;
    }
    return normalized;
  }
  if (typeof value === 'object') {
    if (
      '$oid' in (value as Record<string, unknown>) &&
      typeof (value as { $oid?: unknown }).$oid === 'string'
    ) {
      return coerceTaskId((value as { $oid: string }).$oid);
    }
    if (
      'toString' in (value as Record<string, unknown>) &&
      typeof (value as { toString?: () => unknown }).toString === 'function'
    ) {
      return coerceTaskId((value as { toString: () => unknown }).toString());
    }
  }
  return null;
}

export default coerceTaskId;
