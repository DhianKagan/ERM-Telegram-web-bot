#!/usr/bin/env bash
# Назначение: установка зависимостей и запуск тестов с линтерами.
# Модули: bash, pnpm, docker.
set -euo pipefail
cd "$(dirname "$0")/.."

# Создаём .env из шаблона, если отсутствует
if [ ! -f .env ]; then
  ./scripts/create_env_from_exports.sh
fi

# Сбрасываем URL MongoDB из окружения, чтобы тесты использовали безопасные значения
unset MONGO_DATABASE_URL
unset MONGODB_URI
unset DATABASE_URL

# Устанавливаем зависимости корня, бота и клиента
pnpm install --frozen-lockfile || pnpm install
pnpm install --dir apps/api --frozen-lockfile || pnpm install --dir apps/api
pnpm install --dir apps/web --frozen-lockfile || pnpm install --dir apps/web

# Проверяем отсутствие JavaScript-файлов
./scripts/check_no_js.sh

# Запускаем тесты и линтеры
pnpm --dir apps/api test --detectOpenHandles
pnpm --dir apps/api test tests/csrf.test.ts
pnpm --dir apps/api run test:types
pnpm --dir apps/api run lint
pnpm --dir apps/web run lint

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
