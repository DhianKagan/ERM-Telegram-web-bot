#!/usr/bin/env bash
# Назначение: выгрузка логов деплоя Railway и сохранение их в файл для анализа.
# Модули: bash, Railway CLI, coreutils.
set -euo pipefail

if ! command -v railway >/dev/null 2>&1; then
  echo "Не найден Railway CLI. Установите его командой 'npm install -g @railway/cli' или через другой менеджер." >&2
  exit 1
fi

OUTPUT="Railway/logs/latest-deploy.log"
ARGS=()

while (($#)); do
  case "$1" in
    --output)
      if [[ $# -lt 2 ]]; then
        echo "Для параметра --output требуется путь до файла." >&2
        exit 1
      fi
      OUTPUT="$2"
      shift 2
      ;;
    --help|-h)
      cat <<'USAGE'
Использование: ./scripts/fetch_railway_deploy_logs.sh [опции Railway CLI] [--output <файл>]

Скрипт принимает любые флаги, поддерживаемые командой 'railway logs'.
Чтобы получить подсказку по доступным флагам, выполните 'railway logs --help'.
Примеры:
  ./scripts/fetch_railway_deploy_logs.sh --service erm-api --environment production --deploy latest --tail 400
  ./scripts/fetch_railway_deploy_logs.sh --service erm-api --environment production --deploy <deploy-id> --output Railway/logs/deploy-$(date +%Y%m%d-%H%M).log
USAGE
      exit 0
      ;;
    *)
      ARGS+=("$1")
      shift
      ;;
  esac

done

mkdir -p "$(dirname "$OUTPUT")"

# Логи дублируем в stdout и файл, чтобы их было легко приложить в обсуждении.
railway logs "${ARGS[@]}" | tee "$OUTPUT"
