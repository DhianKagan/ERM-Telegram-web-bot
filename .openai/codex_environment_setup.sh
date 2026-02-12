#!/usr/bin/env bash
# Скрипт для поля «Скрипт установки» в Codex Environment.
# Цель: подготовить окружение агента (Node.js, pnpm, Playwright, Docker CLI, Railway CLI)
# и установить зависимости проекта.
set -euo pipefail

log() {
  echo "[codex-setup] $*"
}

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif have_cmd sudo; then
    sudo "$@"
  else
    "$@"
  fi
}

# Переход в репозиторий, если путь известен контейнеру.
if [ -d /workspace/ERM-Telegram-web-bot ]; then
  cd /workspace/ERM-Telegram-web-bot
fi

if have_cmd apt-get; then
  log "Устанавливаю системные зависимости"
  as_root apt-get update -qq
  as_root apt-get install -y -qq ca-certificates curl gnupg lsb-release
fi

if ! have_cmd node && have_cmd apt-get; then
  log "Node.js отсутствует, устанавливаю LTS"
  curl -fsSL https://deb.nodesource.com/setup_lts.x | as_root -E bash -
  as_root apt-get install -y -qq nodejs
fi

corepack enable || true
PNPM_SPEC=$(node -e "const pkg=require('./package.json'); console.log(pkg.packageManager || 'pnpm@10.20.0')" 2>/dev/null || echo "pnpm@10.20.0")
corepack use "${PNPM_SPEC}"

log "Устанавливаю зависимости проекта"
pnpm -w -s install

NEED_PW="${CI:-}"
if grep -q '"@playwright/test"' package.json 2>/dev/null; then
  NEED_PW="yes"
fi
if [ -n "${E2E_INSTALL:-}" ]; then
  NEED_PW="yes"
fi
if [ -n "${NEED_PW}" ]; then
  if pnpm exec playwright --version >/dev/null 2>&1; then
    log "Устанавливаю браузеры Playwright"
    pnpm exec playwright install --with-deps
  else
    log "CLI Playwright не найден — пропускаю установку браузеров"
  fi
fi

if ! have_cmd docker && have_cmd apt-get; then
  log "Docker не найден, устанавливаю Docker Engine/CLI"
  as_root install -m0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | as_root gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    | as_root tee /etc/apt/sources.list.d/docker.list >/dev/null
  as_root apt-get update -qq
  as_root apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

if have_cmd docker; then
  docker --version || true
  docker compose version || true
fi

if ! have_cmd railway; then
  log "Railway CLI не найден, устанавливаю"
  bash <(curl -fsSL https://railway.app/install.sh) -y
fi

if [ -n "${RAILWAY_API_TOKEN:-}" ]; then
  log "Проверяю Railway API"
  curl -sS -H "Authorization: Bearer ${RAILWAY_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"query":"{ me { name email } }"}' \
    https://backboard.railway.app/graphql/v2 >/dev/null || log "Railway API недоступен"
fi

log "Готово"
