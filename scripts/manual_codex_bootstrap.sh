#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

resolve_repo_root() {
  local candidate=""

  if candidate="$(git -C "${PWD}" rev-parse --show-toplevel 2>/dev/null)"; then
    if [ -f "$candidate/.openai/codex_environment_setup.sh" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  fi

  candidate="$(cd "$SCRIPT_DIR/.." && pwd)"
  if [ -f "$candidate/.openai/codex_environment_setup.sh" ]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  if [ -f "$PWD/.openai/codex_environment_setup.sh" ]; then
    printf '%s\n' "$PWD"
    return 0
  fi

  echo "Не удалось определить корень репозитория с .openai/codex_environment_setup.sh" >&2
  return 1
}

REPO_ROOT="$(resolve_repo_root)"

# Не падаем на недоступной Mongo в контейнере
export CODEX_STRICT_MONGO_TEST="${CODEX_STRICT_MONGO_TEST:-0}"

# Запуск через обёртку в .openai независимо от текущей директории
cd "$REPO_ROOT"
exec bash "$REPO_ROOT/.openai/codex_environment_setup.sh" "$@"
