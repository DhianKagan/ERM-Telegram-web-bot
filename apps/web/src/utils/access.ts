// Назначение: утилиты проверки прав доступа по маске
// Основные модули: отсутствуют
export const ACCESS_USER = 1;
export const ACCESS_ADMIN = 2;
export const ACCESS_MANAGER = 4;
export const ACCESS_TASK_DELETE = 8;
export const ARCHIVE_ACCESS = ACCESS_ADMIN | ACCESS_MANAGER;

export function hasAccess(mask: number | undefined, required: number): boolean {
  if (typeof mask !== 'number' || Number.isNaN(mask)) {
    return false;
  }
  let effectiveMask = mask;
  if ((mask & ACCESS_TASK_DELETE) === ACCESS_TASK_DELETE) {
    effectiveMask |= ACCESS_ADMIN | ACCESS_MANAGER;
  }
  return (effectiveMask & required) === required;
}
