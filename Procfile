# Назначение файла: команды запуска на Railway.
# Запускает сервисы через pm2.
# После сборки выполняем скрипт синхронизации команд меню.
web: pnpm build \
  && ./scripts/set_bot_commands.sh \
  && pnpm --filter telegram-task-bot run start:pm2
