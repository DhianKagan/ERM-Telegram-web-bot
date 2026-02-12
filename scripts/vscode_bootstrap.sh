#!/usr/bin/env bash
# Назначение: подготовка локальной разработки (Node.js/pnpm, .env, Playwright, Docker, Railway CLI, сборка web).
# Модули: bash, apt (опционально), corepack, pnpm, docker, railway.
set -euo pipefail

cd "$(dirname "$0")/.."

log() {
  echo "[vscode_bootstrap] $*"
}

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

run_sudo() {
  if have_cmd sudo; then
    sudo "$@"
  else
    "$@"
  fi
}

if have_cmd apt-get; then
  log "Обновление apt-пакетов (ca-certificates, curl, gnupg, lsb-release)..."
  run_sudo apt-get update -qq
  run_sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release
fi

if ! have_cmd node && have_cmd apt-get; then
  log "Node.js не найден, устанавливаю LTS из NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_lts.x | run_sudo -E bash -
  run_sudo apt-get install -y -qq nodejs
fi

corepack enable || true

if have_cmd node; then
  PNPM_SPEC=$(node -e "const pkg=require('./package.json'); console.log(pkg.packageManager || 'pnpm@10.20.0')" 2>/dev/null || echo "pnpm@10.20.0")
else
  PNPM_SPEC="pnpm@10.20.0"
fi
corepack use "${PNPM_SPEC}"

if [ ! -f .env ]; then
  ./scripts/create_env_from_exports.sh
fi

pnpm install --frozen-lockfile || pnpm install

NEED_PW="${CI:-}"
if grep -q '"@playwright/test"' package.json 2>/dev/null; then
  NEED_PW="yes"
fi
if [ -n "${E2E_INSTALL:-}" ]; then
  NEED_PW="yes"
fi
if [ -n "${NEED_PW}" ]; then
  log "Установка браузеров Playwright..."
  if pnpm exec playwright --version >/dev/null 2>&1; then
    pnpm exec playwright install --with-deps
    log "Playwright browsers установлены"
  else
    log "@playwright/test не найден — пропускаю установку браузеров"
  fi
fi

if ! have_cmd docker && have_cmd apt-get; then
  log "Docker не найден, устанавливаю..."
  run_sudo install -m0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | run_sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    | run_sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  run_sudo apt-get update -qq
  run_sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  if have_cmd systemctl && [ -d /run/systemd/system ]; then
    run_sudo systemctl enable --now docker
  else
    run_sudo dockerd >/tmp/dockerd.log 2>&1 &
    sleep 3
  fi
fi

if have_cmd docker; then
  docker --version
  docker compose version
fi

if ! have_cmd railway; then
  log "Railway CLI не найден, устанавливаю..."
  bash <(curl -fsSL https://railway.app/install.sh) -y
fi

if [ -n "${RAILWAY_API_TOKEN:-}" ]; then
  curl -H "Authorization: Bearer ${RAILWAY_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"query":"{ me { name email } }"}' \
    https://backboard.railway.app/graphql/v2 || log "Railway API недоступен"
fi

pnpm --filter web run build:dist
pnpm dlx playwright doctor || pnpm dlx playwright install --list

log "Подготовка окружения завершена"
