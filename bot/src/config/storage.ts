// Конфигурация каталога загрузок
// Модули: path
import path from 'path';

export const uploadsDir =
  process.env.STORAGE_DIR ?? path.join('bot', 'public', 'uploads');
