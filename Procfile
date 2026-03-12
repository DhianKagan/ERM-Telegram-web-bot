# Назначение файла: команды запуска на Railway.
# Запускает сервисы через pm2.
# После сборки выполняем скрипт синхронизации команд меню.
web: pnpm build && ./start-by-role.sh
worker: pnpm --filter worker run start
