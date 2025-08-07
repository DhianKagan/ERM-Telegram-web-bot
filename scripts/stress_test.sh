#!/usr/bin/env bash
# Назначение: запуск стресс-теста через locust согласно плану
# Модули: bash, locust
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v locust >/dev/null; then
  locust -f loadtest/locustfile.py --host http://localhost:3000 \
    --users 10 --spawn-rate 10 --run-time 1m --headless >/dev/null
else
  echo "Предупреждение: Locust не установлен, стресс-тест пропущен." >&2
fi

