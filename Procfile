# Назначение файла: команды запуска на Railway.
# Запускает сервисы через pm2.
# После сборки выполняем скрипт синхронизации команд меню.
web: pnpm build \
  && ./scripts/set_bot_commands.sh \
  && npx --prefix apps/api pm2-runtime apps/api/ecosystem.config.cjs
