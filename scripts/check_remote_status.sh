#!/usr/bin/env bash
# Назначение файла: проверка статуса удалённого сервера с ботом. Основные модули: ssh, pm2, curl.
set -euo pipefail

HOST=${DEPLOY_SSH_HOST:-}
USER=${DEPLOY_SSH_USER:-}
PORT=${DEPLOY_SSH_PORT:-}
KEY_PATH=${DEPLOY_SSH_KEY_PATH:-$HOME/.ssh/id_rsa}
PUBLIC_URL=${DEPLOY_PUBLIC_URL:-}

if [[ -z "$HOST" || -z "$USER" ]]; then
  echo "Не заданы DEPLOY_SSH_HOST и DEPLOY_SSH_USER." >&2
  exit 1
fi

if [[ -n ${DEPLOY_SSH_KEY_PATH:-} && ! -f "$KEY_PATH" ]]; then
  echo "Файл ключа $KEY_PATH не найден." >&2
  exit 1
fi

SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)
if [[ -n "$PORT" ]]; then
  SSH_OPTS+=( -p "$PORT" )
fi
if [[ -f "$KEY_PATH" ]]; then
  SSH_OPTS+=( -i "$KEY_PATH" )
fi

echo '>>> pm2 status'
ssh "${SSH_OPTS[@]}" "$USER@$HOST" "pm2 status" || {
  echo "Не удалось получить статус pm2." >&2
  exit 1
}

echo '>>> pm2 logs (последние 20 строк)'
ssh "${SSH_OPTS[@]}" "$USER@$HOST" "pm2 logs --nostream --lines 20" || echo "Не удалось прочитать логи pm2." >&2

if [[ -n "$PUBLIC_URL" ]]; then
  echo ">>> curl $PUBLIC_URL/health"
  if ! curl -fsSL "$PUBLIC_URL/health"; then
    echo "Проверка /health завершилась ошибкой." >&2
  fi
fi
