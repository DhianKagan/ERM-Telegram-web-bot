#!/bin/bash
# Назначение скрипта: сборка пакетов с уникальным временным каталогом.
# Основные модули: pnpm, mktemp, flock.
set -e
cd "$(dirname "$0")/.."
TMP_DIR=$(mktemp -d)
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT
(
  flock -x 9
  TMPDIR="$TMP_DIR" pnpm build --workspace-concurrency=1
) 9>/tmp/pnpm_build.lock
