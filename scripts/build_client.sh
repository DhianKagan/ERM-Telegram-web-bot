#!/bin/bash
# Назначение скрипта: установка зависимостей и сборка фронтенда в отдельном TMPDIR.
# Модули: npm, mktemp, bash.
set -e
cd "$(dirname "$0")/.."
TMP_DIR=$(mktemp -d)
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT
if [ ! -d apps/web/node_modules ]; then
  TMPDIR="$TMP_DIR" npm --prefix apps/web install > /tmp/npm_install.log 2>&1 && tail -n 20 /tmp/npm_install.log
fi
TMPDIR="$TMP_DIR" npm --prefix apps/api run build-client > /tmp/npm_build.log 2>&1 && tail -n 20 /tmp/npm_build.log

