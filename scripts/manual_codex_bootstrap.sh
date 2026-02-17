#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Не падаем на недоступной Mongo в контейнере
export CODEX_STRICT_MONGO_TEST="${CODEX_STRICT_MONGO_TEST:-0}"

# Запуск через обёртку в .openai независимо от текущей директории
cd "$REPO_ROOT"
exec bash "$REPO_ROOT/.openai/codex_environment_setup.sh" "$@"
