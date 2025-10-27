#!/usr/bin/env bash
# Назначение: генерация `.env` из текущего окружения.
# Модули: стандартные возможности bash.
# Поддержка специальных символов обеспечивается использованием экранирования.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
ENV_FILE="$DIR/.env"
EXAMPLE="$DIR/.env.example"
if [[ -f $ENV_FILE ]]; then
  echo "$ENV_FILE уже существует" >&2
  exit 0
fi
if [[ ! -f $EXAMPLE ]]; then
  echo "$EXAMPLE не найден" >&2
  exit 1
fi

declare -A DEFAULTS=(
  [BOT_TOKEN]="$(openssl rand -hex 16)"
  [CHAT_ID]="$(shuf -i 100000000-999999999 -n 1)"
  [JWT_SECRET]="$(openssl rand -hex 32)"
  [SESSION_SECRET]="$(openssl rand -hex 64)"
  [APP_URL]="https://localhost:3000"
  [MONGO_DATABASE_URL]="mongodb://admin:admin@localhost:27017/ermdb?authSource=admin"
)

while IFS= read -r line; do
  [[ -z $line || $line == \#* ]] && continue
  key=${line%%=*}
  def=${line#*=}
  fallback="${DEFAULTS[$key]:-$def}"
  val="${!key:-$fallback}"
  if [[ $key == MONGO_DATABASE_URL ]]; then
    val="$(
      MONGO_CANDIDATE="$val" MONGO_FALLBACK="$fallback" node <<'EOF'
const candidate = process.env.MONGO_CANDIDATE ?? '';
const fallback = process.env.MONGO_FALLBACK ?? '';

const normalize = (input, alternative) => {
  const trimmed = input.trim().split(/\s+/)[0] ?? '';
  if (!trimmed || !/^mongodb(\+srv)?:\/\//.test(trimmed)) {
    if (alternative) {
      return normalize(alternative, '');
    }
    throw new Error('invalid mongo url');
  }

  const protocolEnd = trimmed.indexOf('://');
  const protocol = trimmed.slice(0, protocolEnd).toLowerCase();
  const remainder = trimmed.slice(protocolEnd + 3);

  const slashIndex = remainder.indexOf('/');
  if (slashIndex === -1) {
    if (alternative) {
      return normalize(alternative, '');
    }
    throw new Error('mongo url must contain db name');
  }

  const authority = remainder.slice(0, slashIndex);
  const pathAndQuery = remainder.slice(slashIndex + 1);

  const questionIndex = pathAndQuery.indexOf('?');
  const dbName = questionIndex === -1 ? pathAndQuery : pathAndQuery.slice(0, questionIndex);
  const query = questionIndex === -1 ? '' : pathAndQuery.slice(questionIndex + 1);

  if (!dbName) {
    if (alternative) {
      return normalize(alternative, '');
    }
    throw new Error('mongo url must contain db name');
  }

  const params = new URLSearchParams(query);
  if (!params.get('authSource')) {
    params.set('authSource', 'admin');
  }

  const serializedParams = params.toString();
  const suffix = serializedParams ? `?${serializedParams}` : '';

  return `${protocol}://${authority}/${dbName}${suffix}`;
};

process.stdout.write(normalize(candidate, fallback));
EOF
    )"
    printf '%s=%s\n' "$key" "$val"
    continue
  fi
  printf '%s=%q\n' "$key" "$val"
done < "$EXAMPLE" > "$ENV_FILE"
echo "$ENV_FILE обновлён"
