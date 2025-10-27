#!/usr/bin/env bash
# Назначение: верификация наличия обязательных инструментов CI/CD и тестов.
# Модули: bash, find.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

declare -a missing=()

check_file() {
  local rel_path="$1"
  local label="$2"
  local full_path="$ROOT/$rel_path"
  if [ ! -f "$full_path" ]; then
    missing+=("${label} отсутствует: $rel_path")
    return
  fi
  if [ ! -s "$full_path" ]; then
    missing+=("${label} пуст: $rel_path")
  fi
}

check_dir() {
  local rel_path="$1"
  local label="$2"
  local full_path="$ROOT/$rel_path"
  if [ ! -d "$full_path" ]; then
    missing+=("${label} отсутствует: $rel_path")
    return
  fi
  if ! find "$full_path" -mindepth 1 -maxdepth 4 -type f -print -quit | grep -q .; then
    missing+=("${label} не содержит файлов: $rel_path")
  fi
}

check_tests() {
  local rel_path="$1"
  local full_path="$ROOT/$rel_path"
  if [ ! -d "$full_path" ]; then
    missing+=("Тесты отсутствуют: $rel_path")
    return
  fi
  if ! find "$full_path" -type f \( -name '*.spec.ts' -o -name '*.spec.tsx' -o -name '*.test.ts' -o -name '*.test.tsx' \) -print -quit | grep -q .; then
    missing+=("В каталоге тестов нет файлов с расширением spec/test: $rel_path")
  fi
}

check_file ".github/workflows/ci.yml" "Workflow CI"
check_file ".github/workflows/codeql.yml" "Workflow CodeQL"
check_file ".github/workflows/pre-pr-check.yml" "Workflow Pre PR Check"
check_file ".github/workflows/deploy.yml" "Workflow Deploy"
check_file ".github/workflows/docker.yml" "Workflow Docker"
check_file ".github/workflows/lighthouse.yml" "Workflow Lighthouse"
check_file ".github/workflows/release.yml" "Workflow Release"
check_file "Procfile" "Procfile"
check_file "Procfile.railway" "Procfile Railway"
check_dir "Railway" "Каталог Railway"
check_dir "Railway/config" "Каталог конфигурации Railway"
check_file "Railway/.env" "Railway .env"
check_file "railway.json" "Railway JSON конфигурация"
check_tests "tests"

if [ ${#missing[@]} -ne 0 ]; then
  {
    echo "Обнаружены проблемы с обязательными инструментами CI/CD:" >&2
    for issue in "${missing[@]}"; do
      echo " - $issue" >&2
    done
  }
  exit 1
fi

echo "Все обязательные инструменты CI/CD на месте."
