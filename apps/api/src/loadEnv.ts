import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Загружаем из нескольких возможных мест, не перезаписывая уже заданные переменные
const candidates = [
  path.resolve(process.cwd(), 'apps/api/.env.local'),
  path.resolve(process.cwd(), 'apps/api/.env'),
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
];

for (const p of candidates) {
  if (fs.existsSync(p)) {
    config({ path: p, override: false });
  }
}
