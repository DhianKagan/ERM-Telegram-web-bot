# Назначение файла: команды запуска на Railway.
# Запускает сервисы через pm2.
# После сборки клиента выполняем скрипт синхронизации команд меню.
web: npm --prefix bot run build-client \
  && ./scripts/set_bot_commands.sh \
  && npx --prefix bot pm2-runtime bot/ecosystem.config.cjs
