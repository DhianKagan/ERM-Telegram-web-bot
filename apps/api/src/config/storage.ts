// Конфигурация каталога загрузок
// Модули: path
import path from 'path';

export const uploadsDir = path.resolve(
  process.env.STORAGE_DIR || path.join('apps', 'api', 'public', 'uploads'),
);
