# Назначение файла: команды запуска на Railway.
# Запускает сервисы через pm2.
# После сборки клиента выполняем скрипт синхронизации команд меню.
web: npm --prefix apps/api run build-client \
  && ./scripts/set_bot_commands.sh \
  && npx --prefix apps/api pm2-runtime apps/api/ecosystem.config.cjs
