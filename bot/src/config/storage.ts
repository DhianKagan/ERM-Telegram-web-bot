// Конфигурация каталога загрузок
// Модули: path
import path from 'path';

const defaultDir = path.resolve(__dirname, '..', '..', 'public', 'uploads');

const envDir = process.env.STORAGE_DIR?.trim();

export const uploadsDir = envDir ? path.resolve(envDir) : defaultDir;
