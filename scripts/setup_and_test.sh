#!/usr/bin/env bash
# Назначение: установка зависимостей и запуск тестов с линтерами.
# Модули: bash, pnpm, docker.
set -euo pipefail
cd "$(dirname "$0")/.."

# Создаём .env из шаблона, если отсутствует
if [ ! -f .env ]; then
  ./scripts/create_env_from_exports.sh
fi

# Устанавливаем зависимости бота и клиента
pnpm install --dir bot --frozen-lockfile || pnpm install --dir bot
pnpm install --dir bot/web --frozen-lockfile || pnpm install --dir bot/web

# Проверяем отсутствие JavaScript-файлов
./scripts/check_no_js.sh

# Запускаем тесты и линтеры
pnpm --dir bot test -- --detectOpenHandles
pnpm --dir bot test tests/csrf.test.ts
pnpm --dir bot run test:types
pnpm --dir bot run lint
pnpm --dir bot/web run lint

# Проверяем конфигурацию docker compose при наличии команды docker
if command -v docker >/dev/null; then
  if [ -f docker-compose.yml ]; then
    docker compose config >/dev/null
  fi
else
  echo "Предупреждение: Docker не найден, пропускаем проверку docker compose." >&2
fi

# Запускаем стресс-тест при наличии locust
./scripts/stress_test.sh
