#!/usr/bin/env bash
# Назначение: запуск Semgrep с установкой зависимостей по требованию.
# Основные модули: pip, semgrep, локальные правила проекта.
set -euo pipefail

export PATH="${HOME}/.local/bin:${PATH}"

if ! command -v semgrep >/dev/null 2>&1; then
  python3 -m pip install --user --no-warn-script-location --disable-pip-version-check "semgrep==1.96.0"
fi

exec semgrep ci --metrics=off --config p/owasp-top-ten --config semgrep/ci.yml "$@"
