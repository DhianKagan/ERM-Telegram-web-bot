# Назначение файла: команды запуска на Railway.
# Запускает сервисы через pm2.
# После сборки выполняем скрипт синхронизации команд меню.
web: pnpm build \
  && ./scripts/set_bot_commands.sh \
  && pnpm --filter apps/api run start:pm2
worker: pnpm --filter worker run start
