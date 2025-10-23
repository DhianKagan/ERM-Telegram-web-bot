// Назначение файла: константы масок доступа и проверка прав
// Основные модули: отсутствуют
export const ACCESS_USER = 1;
export const ACCESS_ADMIN = 2;
export const ACCESS_MANAGER = 4;
export const ACCESS_TASK_DELETE = 8;

export function hasAccess(mask: number, required: number): boolean {
  let effectiveMask = mask;
  if ((effectiveMask & ACCESS_TASK_DELETE) === ACCESS_TASK_DELETE) {
    effectiveMask |= ACCESS_ADMIN | ACCESS_MANAGER;
  }
  if ((effectiveMask & (ACCESS_ADMIN | ACCESS_MANAGER)) !== 0) {
    effectiveMask |= ACCESS_USER;
  }
  return (effectiveMask & required) === required;
}
