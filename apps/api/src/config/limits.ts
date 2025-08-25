// Лимиты вложений на пользователя
// Модули: none
export const maxUserFiles = Number(process.env.USER_FILES_MAX_COUNT ?? '20');
export const maxUserStorage = Number(
  process.env.USER_FILES_MAX_SIZE ?? String(50 * 1024 * 1024),
);
