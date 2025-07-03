// Конфигурация pm2 для запуска API и бота
module.exports = {
  apps: [
    {
      name: 'api',
      script: 'src/api/api.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
    },
    {
      name: 'bot',
      script: 'src/bot/bot.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
    }
  ]
}
