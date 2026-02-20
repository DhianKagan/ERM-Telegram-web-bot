#!/bin/sh
set -eu

APP_ROLE_RAW="${APP_ROLE:-all}"
APP_ROLE_TOKEN="$(printf '%s' "$APP_ROLE_RAW" | awk '{print $1}')"

APP_ROLE_NORMALIZED="$(printf '%s' "${APP_ROLE_TOKEN:-all}" | tr '[:upper:]' '[:lower:]')"

case "$APP_ROLE_NORMALIZED" in
  api)
    exec node apps/api/dist/server.js
    ;;
  bot)
    exec node apps/api/dist/bot/runtime.js
    ;;
  worker)
    exec node apps/worker/dist/index.js
    ;;
  all|"")
    node dist/scripts/db/ensureDefaults.js
    mkdir -p /var/log/pm2
    cd apps/api
    ./node_modules/.bin/pm2 install pm2-logrotate
    ./node_modules/.bin/pm2 set pm2-logrotate:max_size 10M
    ./node_modules/.bin/pm2 set pm2-logrotate:retain 7
    ./node_modules/.bin/pm2 set pm2-logrotate:compress true
    exec ./node_modules/.bin/pm2-runtime ecosystem.config.cjs
    ;;
  *)
    echo "Unsupported APP_ROLE='$APP_ROLE'. Expected: api | bot | worker | all" >&2
    exit 1
    ;;
esac
