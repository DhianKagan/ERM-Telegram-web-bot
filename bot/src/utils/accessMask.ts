// Назначение файла: константы масок доступа и проверка прав
// Основные модули: отсутствуют
export const ACCESS_USER = 1;
export const ACCESS_ADMIN = 2;
export const ACCESS_MANAGER = 4;

export function hasAccess(mask: number, required: number): boolean {
  return (mask & required) === required;
}

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(module as any).exports = {
  ACCESS_USER,
  ACCESS_ADMIN,
  ACCESS_MANAGER,
  hasAccess,
};
