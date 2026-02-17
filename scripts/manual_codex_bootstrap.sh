#!/usr/bin/env bash
set -euo pipefail

# Не падаем на недоступной Mongo в контейнере
export CODEX_STRICT_MONGO_TEST="${CODEX_STRICT_MONGO_TEST:-0}"

# Запуск через обёртку в .openai
bash ./.openai/codex_environment_setup.sh "$@"
