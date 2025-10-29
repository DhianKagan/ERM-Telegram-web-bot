#!/usr/bin/env bash
# Назначение: получение списка изменённых файлов относительно базовой ветки.
# Основные модули: git diff, git ls-files, обработка переменных CI.
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

base_ref="${CODEX_BASE_REF:-}"
if [[ -z "$base_ref" && -n "${GITHUB_BASE_REF:-}" ]]; then
  base_ref="origin/${GITHUB_BASE_REF}"
fi

files=()
if [[ -n "$base_ref" ]]; then
  if git rev-parse --verify "$base_ref" >/dev/null 2>&1; then
    mapfile -t files < <(git diff --name-only --diff-filter=ACMRTUXB "${base_ref}...HEAD")
  fi
fi

if [[ ${#files[@]} -eq 0 ]]; then
  if [[ -n "${CI:-}" ]]; then
    if git rev-parse --verify HEAD^ >/dev/null 2>&1; then
      mapfile -t files < <(git diff --name-only --diff-filter=ACMRTUXB HEAD^ HEAD)
    else
      mapfile -t files < <(git diff --name-only --diff-filter=ACMRTUXB HEAD)
    fi
  else
    mapfile -t files < <(git diff --name-only --diff-filter=ACMRTUXB HEAD)
  fi
fi

mapfile -t untracked < <(git ls-files --others --exclude-standard)
files+=("${untracked[@]}")

if [[ ${#files[@]} -eq 0 ]]; then
  exit 0
fi

printf '%s\n' "${files[@]}" | sed '/^$/d' | sort -u
