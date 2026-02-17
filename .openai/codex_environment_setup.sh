#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET_SCRIPT="$REPO_ROOT/codex_environment_setup.sh"

if [ ! -f "$TARGET_SCRIPT" ]; then
  echo "❌ Не найден $TARGET_SCRIPT" >&2
  exit 1
fi

if [ ! -x "$TARGET_SCRIPT" ]; then
  chmod +x "$TARGET_SCRIPT" || true
fi

echo "==> Запуск ручного bootstrap: $TARGET_SCRIPT"
exec "$TARGET_SCRIPT" "$@"
