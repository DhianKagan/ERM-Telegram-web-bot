/**
 * Назначение файла: конфигурация pm2 для запуска API и бота.
 * Основные модули: pm2.
 */
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  apps: [
    {
      name: 'api',
      script: 'dist/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: 5000,
      restart_delay: 5000,
    },
    {
      name: 'bot',
      script: 'dist/bot/runtime.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: 5000,
      restart_delay: 5000,
    },
  ],
};
