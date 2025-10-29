#!/usr/bin/env bash
# Назначение: запуск статического анализа кода на уязвимости.
# Модули: bash, pnpm, eslint.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v pnpm >/dev/null; then
  echo "pnpm не найден" >&2
  exit 1
fi

pnpm exec eslint \
  --config eslint.security.config.ts \
  --ext .ts,.tsx \
  apps/api packages scripts
