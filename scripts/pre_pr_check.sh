#!/usr/bin/env bash
# Назначение: проверка сборки и запуска бота перед пулл-реквестом.
# Модули: bash, npm.
set -euo pipefail
cd "$(dirname "$0")/.."

./scripts/create_env_from_exports.sh >/dev/null || true

./scripts/audit_deps.sh

./scripts/build_client.sh >/dev/null
if [ ! -f bot/public/.vite/manifest.json ] || ! ls bot/public/assets/index*.js >/dev/null 2>&1; then
  echo "Отсутствует собранный JS-бандл" >&2
  exit 1
fi

until npm --prefix bot run build; do
  echo "Сборка не удалась, устанавливаем зависимости..."
  npm --prefix bot install
done

attempt=1
max_attempts=5
while [ $attempt -le $max_attempts ]; do
  if timeout 5s npm --prefix bot run start >/tmp/bot_start.log 2>&1; then
    echo "Проверка сборки и запуска завершена."
    exit 0
  fi
  status=$?
  if [ "$status" -eq 124 ]; then
    echo "Проверка сборки и запуска завершена."
    exit 0
  fi
  echo "Запуск не удался, пробуем ещё раз..."
  npm --prefix bot run build || npm --prefix bot install
  attempt=$((attempt + 1))
done

echo "Не удалось запустить бот" >&2
exit 1
