#!/usr/bin/env bash
# Назначение: автоматизирует получение логов Railway, анализ и запуск улучшений кода.
# Модули: bash, Railway CLI, Node.js, pnpm.

set -euo pipefail

CONFIG_PATH="Railway/config/pipeline.env"
SKIP_IMPROVEMENTS=0
DRY_RUN=0
SERVICE=""
ENVIRONMENT=""
DEPLOY=""
TAIL=""
PREFIX=""
ANALYSIS_DIR=""

usage() {
  cat <<'USAGE'
Использование: ./scripts/railway_log_pipeline.sh [опции]

Опции:
  --config <файл>           Путь к файлу конфигурации (по умолчанию Railway/config/pipeline.env)
  --service <имя>           Имя сервиса Railway (перекрывает конфигурацию)
  --environment <имя>       Имя окружения Railway
  --deploy <id|latest>      Идентификатор деплоя или latest
  --tail <число>            Количество строк лога для загрузки
  --prefix <имя>            Базовый префикс для файлов отчёта
  --output-dir <каталог>    Каталог для сохранения отчётов анализа
  --skip-improvements       Не запускать автоматические команды улучшений
  --dry-run                 Только показать шаги без выполнения
  --help                    Показать справку
USAGE
}

while (($#)); do
  case "$1" in
    --config)
      CONFIG_PATH="$2"
      shift 2
      ;;
    --service)
      SERVICE="$2"
      shift 2
      ;;
    --environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --deploy)
      DEPLOY="$2"
      shift 2
      ;;
    --tail)
      TAIL="$2"
      shift 2
      ;;
    --prefix)
      PREFIX="$2"
      shift 2
      ;;
    --output-dir)
      ANALYSIS_DIR="$2"
      shift 2
      ;;
    --skip-improvements)
      SKIP_IMPROVEMENTS=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Неизвестный параметр: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -f "$CONFIG_PATH" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_PATH"
fi

SERVICE=${SERVICE:-${RAILWAY_SERVICE:-}}
ENVIRONMENT=${ENVIRONMENT:-${RAILWAY_ENVIRONMENT:-}}
DEPLOY=${DEPLOY:-${RAILWAY_DEPLOY:-latest}}
TAIL=${TAIL:-${RAILWAY_TAIL:-400}}

if [[ -z "$SERVICE" ]]; then
  echo "Не задано имя сервиса Railway. Укажите --service или переменную RAILWAY_SERVICE." >&2
  exit 1
fi

if [[ -z "$ENVIRONMENT" ]]; then
  echo "Не задано имя окружения Railway. Укажите --environment или переменную RAILWAY_ENVIRONMENT." >&2
  exit 1
fi

PREFIX=${PREFIX:-"${SERVICE}-${ENVIRONMENT}"}

LOG_DIR="Railway/logs"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$LOG_DIR/${PREFIX}-${DEPLOY}-${TIMESTAMP}.log"

FETCH_ARGS=(--service "$SERVICE" --environment "$ENVIRONMENT" --tail "$TAIL")
if [[ -n "$DEPLOY" ]]; then
  FETCH_ARGS+=(--deploy "$DEPLOY")
fi

echo "Запрашиваем логи Railway для сервиса '$SERVICE' в окружении '$ENVIRONMENT' (deploy=$DEPLOY, tail=$TAIL)."

if (( DRY_RUN )); then
  echo "[dry-run] ./scripts/fetch_railway_deploy_logs.sh ${FETCH_ARGS[*]} --output $LOG_FILE"
else
  ./scripts/fetch_railway_deploy_logs.sh "${FETCH_ARGS[@]}" --output "$LOG_FILE"
fi

ANALYSIS_ARGS=("$LOG_FILE" --prefix "${PREFIX}-${DEPLOY}")
if [[ -n "$ANALYSIS_DIR" ]]; then
  ANALYSIS_ARGS+=(--output-dir "$ANALYSIS_DIR")
fi

TMP_RESULT=$(mktemp)

if (( DRY_RUN )); then
  echo "[dry-run] node scripts/analyze_railway_logs.mjs ${ANALYSIS_ARGS[*]}"
  rm -f "$TMP_RESULT"
  exit 0
fi

if ! node scripts/analyze_railway_logs.mjs "${ANALYSIS_ARGS[@]}" >"$TMP_RESULT"; then
  echo "Не удалось проанализировать логи." >&2
  rm -f "$TMP_RESULT"
  exit 1
fi

JSON_PATH=$(node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));console.log(data.jsonPath);" "$TMP_RESULT")
MARKDOWN_PATH=$(node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));console.log(data.markdownPath);" "$TMP_RESULT")

echo "Аналитический отчёт: $MARKDOWN_PATH"

node - "$JSON_PATH" <<'NODE'
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!data.recommendations || data.recommendations.length === 0) {
  console.log('Автоматические действия не требуются.');
  process.exit(0);
}

const auto = data.recommendations.filter((item) => item.autoRun && item.command);
const manual = data.recommendations.filter((item) => !item.autoRun);

if (auto.length) {
  console.log('Запланированы автоматические команды:');
  auto.forEach((item) => {
    console.log(` - ${item.command} ← ${item.reason}`);
  });
} else {
  console.log('Автоматические команды отсутствуют.');
}

if (manual.length) {
  console.log('\nРучные рекомендации:');
  manual.forEach((item) => {
    console.log(` - ${item.title}: ${item.reason}`);
  });
}
NODE

if (( SKIP_IMPROVEMENTS )); then
  echo "Пропуск выполнения автоматических команд по флагу --skip-improvements."
  rm -f "$TMP_RESULT"
  exit 0
fi

mapfile -t AUTO_COMMANDS < <(node - "$JSON_PATH" <<'NODE'
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const commands = (data.recommendations || []).filter((item) => item.autoRun && item.command).map((item) => item.command);
for (const command of commands) {
  console.log(command);
}
NODE
)

FAILED_COMMANDS=()

for cmd in "${AUTO_COMMANDS[@]}"; do
  if [[ -z "$cmd" ]]; then
    continue
  fi
  echo "Выполняю: $cmd"
  if ! bash -c "$cmd"; then
    echo "Команда завершилась с ошибкой: $cmd" >&2
    FAILED_COMMANDS+=("$cmd")
  fi
done

rm -f "$TMP_RESULT"

if ((${#FAILED_COMMANDS[@]})); then
  echo "Некоторые автоматические действия завершились с ошибкой." >&2
  exit 1
fi

echo "Конвейер логов Railway выполнен успешно."
