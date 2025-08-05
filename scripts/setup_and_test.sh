#!/usr/bin/env bash
# Назначение: установка зависимостей и запуск тестов с линтерами.
# Модули: bash, npm, docker.
set -euo pipefail
cd "$(dirname "$0")/.."

# Создаём .env из шаблона, если отсутствует
if [ ! -f .env ]; then
  ./scripts/create_env_from_exports.sh
fi

# Устанавливаем зависимости бота и клиента
npm ci --prefix bot || npm --prefix bot install
npm ci --prefix bot/web || npm --prefix bot/web install

# Запускаем тесты и линтеры
npm test --prefix bot -- --detectOpenHandles
npm test --prefix bot tests/csrf.test.ts
npx eslint bot/src
npm run lint --prefix bot/web

# Проверяем конфигурацию docker compose при наличии команды docker
if command -v docker >/dev/null; then
  if [ -f docker-compose.yml ]; then
    docker compose config >/dev/null
  fi
else
  echo "Предупреждение: Docker не найден, пропускаем проверку docker compose." >&2
fi
