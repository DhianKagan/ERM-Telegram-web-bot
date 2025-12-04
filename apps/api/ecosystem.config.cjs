/**
 * Назначение файла: конфигурация pm2 для запуска API и бота.
 * Основные модули: pm2.
 */
module.exports = {
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
    {
      name: 'worker',
      script: '../worker/dist/index.js',
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
