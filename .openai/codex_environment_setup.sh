#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# codex_environment_setup.sh
# Безопасный bootstrap окружения для ERM-Telegram-web-bot.
# По умолчанию НЕ модифицирует файлы репозитория.

__XTRACE_WAS_ON=0
case "$-" in
  *x*) __XTRACE_WAS_ON=1; set +x ;;
esac

log()  { echo ">>> $*"; }
ok()   { log "✅ OK: $*"; }
warn() { log "⚠️  $*"; }
fail() { log "❌ $*"; exit 1; }

CURRENT_STEP="(not set)"
progress() {
  local pct="$1"; shift
  local title="$1"; shift
  local outcome="${1:-}"
  CURRENT_STEP="[$pct%] $title"
  if [ -n "$outcome" ]; then
    log "[$pct%] $title — $outcome"
  else
    log "[$pct%] $title"
  fi
}

redact_uri_credentials() {
  local uri="${1:-}"
  [ -z "$uri" ] && { echo ""; return 0; }
  # redact scheme://user:pass@host -> scheme://***:***@host
  printf '%s' "$uri" | sed -E 's#^([a-zA-Z][a-zA-Z0-9+.-]*://)([^/@]+)@#\1***:***@#'
}

redact_mongo_uri() {
  local uri="${1:-}"
  [ -z "$uri" ] && { echo ""; return 0; }
  printf '%s' "$uri" | sed -E 's#(mongodb(\+srv)?://)([^/@]+)@#\1***:***@#I'
}

pretty_pnpm_version() {
  local v="${1:-}"
  if [[ "$v" == *"+sha512."* ]]; then
    printf '%s' "${v%%+sha512.*}"
  else
    printf '%s' "$v"
  fi
}

find_repo_root() {
  # 1) git root (самый надёжный, если мы внутри репо)
  if command -v git >/dev/null 2>&1; then
    local git_root
    if git_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
      if [ -f "$git_root/package.json" ]; then
        echo "$git_root"
        return 0
      fi
    fi
  fi

  # 2) поднимаемся вверх от текущей директории, пока не найдём package.json
  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/package.json" ]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done

  return 1
}

on_error() {
  local exit_code=$?
  echo ""
  log "❌ FAIL at: ${CURRENT_STEP}"
  log "Exit code: ${exit_code}"
  log "Подсказки:"
  log " - Самая первая ошибка выше в логе — главная."
  log " - Проверь, что ты реально в корне репо: pwd && ls && test -f package.json && echo OK"
  log " - Ручная установка зависимостей: pnpm install (из корня репо)"
  log " - Проверка mongo TCP: node -e \"require('net').connect({host:'HOST',port:27017}).on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))\""
  exit "$exit_code"
}
trap on_error ERR

# --- Repo root detection (критично для Manual-mode, где скрипт лежит вне репо) ---
REPO_ROOT="$(find_repo_root)" || fail "Не смог найти корень репозитория (package.json). Запусти из корня репо."
cd "$REPO_ROOT"
[ -f "$REPO_ROOT/package.json" ] || fail "Корень репо выглядит странно: нет package.json в $REPO_ROOT"

export CODEX_SETUP_SAFE_MODE="${CODEX_SETUP_SAFE_MODE:-1}"                 # 1 = не патчить файлы
export CODEX_PATCH_ENSURE_BINARY="${CODEX_PATCH_ENSURE_BINARY:-0}"         # 1 = разрешить патч ensure-mongodb-binary.mjs (только если SAFE_MODE=0)
export CODEX_ALLOW_OVERRIDE_SANITIZE="${CODEX_ALLOW_OVERRIDE_SANITIZE:-0}" # 1 = разрешить санитарить overrides (модифицирует package.json; только если SAFE_MODE=0)
export CODEX_SKIP_INSTALL="${CODEX_SKIP_INSTALL:-0}"                       # 1 = пропустить pnpm install
export CODEX_STRICT_MONGO_TEST="${CODEX_STRICT_MONGO_TEST:-0}"             # 1 = healthcheck mongo станет фатальным

echo "==== codex_environment_setup.sh — start ===="

# --- 10% Proxy normalize ---
progress 10 "Прокси: нормализация переменных" "все инструменты увидят HTTP_PROXY/HTTPS_PROXY"
http_val="$(env | grep -i '^http[-_]*proxy=' | tail -n1 | cut -d= -f2- || true)"
if [ -n "${http_val:-}" ]; then
  export HTTP_PROXY="${HTTP_PROXY:-$http_val}"
  ok "HTTP proxy -> HTTP_PROXY=$(redact_uri_credentials "$HTTP_PROXY")"
else
  warn "HTTP proxy не найден в env (нормально, если прокси не нужен)"
fi

https_val="$(env | grep -i '^https[-_]*proxy=' | tail -n1 | cut -d= -f2- || true)"
if [ -n "${https_val:-}" ]; then
  export HTTPS_PROXY="${HTTPS_PROXY:-$https_val}"
  ok "HTTPS proxy -> HTTPS_PROXY=$(redact_uri_credentials "$HTTPS_PROXY")"
else
  warn "HTTPS proxy не найден в env (нормально, если прокси не нужен)"
fi

# lowercase mirrors
export http_proxy="${http_proxy:-${HTTP_PROXY:-}}"
export https_proxy="${https_proxy:-${HTTPS_PROXY:-}}"
ok "Прокси переменные готовы (HTTP_PROXY/HTTPS_PROXY + http_proxy/https_proxy)"

# --- 25% Mongo URL normalize ---
progress 25 "Mongo URL: проверка/нормализация" "включим USE_REAL_MONGO и поправим tls для Railway"
if [ -n "${MONGO_DATABASE_URL:-}" ]; then
  export USE_REAL_MONGO="true"
  orig="$MONGO_DATABASE_URL"
  new="$orig"

  # Remove accidental '@http(s)://' after credentials
  new="${new//@http:\/\//@}"
  new="${new//@https:\/\//@}"

  # Railway TCP proxy -> add tls=false if missing
  if echo "$new" | grep -q "proxy.rlwy.net" && ! echo "$new" | grep -q -E "([&?])tls="; then
    if echo "$new" | grep -q '\?'; then
      new="${new}&tls=false"
    else
      new="${new}?tls=false"
    fi
    warn "Railway TCP proxy detected -> добавил tls=false"
  fi

  # Public up.railway.app -> add tls=true if missing
  if echo "$new" | grep -q "\.up\.railway\.app" && ! echo "$new" | grep -q -E "([&?])tls="; then
    if echo "$new" | grep -q '\?'; then
      new="${new}&tls=true"
    else
      new="${new}?tls=true"
    fi
    warn ".up.railway.app detected -> добавил tls=true"
  fi

  export MONGO_DATABASE_URL="$new"
  ok "MONGO_DATABASE_URL=$(redact_mongo_uri "$MONGO_DATABASE_URL")"

  if [ "$new" != "$orig" ]; then
    log "before: $(redact_mongo_uri "$orig")"
    log "after : $(redact_mongo_uri "$new")"
  fi
else
  warn "MONGO_DATABASE_URL не задан — внешний Mongo не настроен"
fi

# --- 40% Prevent mongodb-memory-server downloads ---
progress 40 "mongodb-memory-server" "запрет скачивания бинарников"
export MONGOMS_SKIP_DOWNLOAD="true"
export MONGOMS_DOWNLOAD_MIRROR="${MONGOMS_DOWNLOAD_MIRROR:-}"
ok "MONGOMS_SKIP_DOWNLOAD=true"

# --- 55% Optional patch ensure-mongodb-binary.mjs ---
progress 55 "ensure-mongodb-binary guard" "по умолчанию без патча (SAFE_MODE)"
if [ "$CODEX_SETUP_SAFE_MODE" = "1" ] || [ "$CODEX_PATCH_ENSURE_BINARY" != "1" ]; then
  ok "SAFE_MODE: patch scripts/ensure-mongodb-binary.mjs пропущен"
else
  ENSURE_SCRIPT="scripts/ensure-mongodb-binary.mjs"
  if [ -f "$ENSURE_SCRIPT" ] && ! grep -q "USE_REAL_MONGO" "$ENSURE_SCRIPT" 2>/dev/null; then
    cp "$ENSURE_SCRIPT" "${ENSURE_SCRIPT}.bak_codex"
    {
      echo "#!/usr/bin/env node"
      echo "if (process.env.USE_REAL_MONGO === 'true') {"
      echo "  console.log('[ensure-mongodb-binary] USE_REAL_MONGO=true — skipping mongodb binary download');"
      echo "  process.exit(0);"
      echo "}"
      # drop old shebang from original
      tail -n +2 "${ENSURE_SCRIPT}.bak_codex"
    } > "${ENSURE_SCRIPT}.tmp"
    mv "${ENSURE_SCRIPT}.tmp" "$ENSURE_SCRIPT"
    chmod +x "$ENSURE_SCRIPT" || true
    ok "Патч применён к $ENSURE_SCRIPT"
  else
    ok "Патч не требуется"
  fi
fi

# --- 75% pnpm version from packageManager ---
progress 75 "pnpm: выбор версии" "берём версию из packageManager (корень репо)"
PNPM_VERSION_DEFAULT="10.29.3"
PNPM_VERSION="$PNPM_VERSION_DEFAULT"
if command -v node >/dev/null 2>&1; then
  PNPM_VERSION_FROM_PKG="$(node -p "(()=>{try{const pm=require('./package.json').packageManager||'';const m=String(pm).match(/^pnpm@(.+)$/);return m?m[1]:''}catch(e){return ''}})()")"
  if [ -n "${PNPM_VERSION_FROM_PKG:-}" ]; then
    PNPM_VERSION="$PNPM_VERSION_FROM_PKG"
  fi
fi
ok "pnpm target: $(pretty_pnpm_version "$PNPM_VERSION")"

# --- 90% Install deps (pnpm) ---
progress 90 "Зависимости" "pnpm install (frozen) + fallback"
if [ "$CODEX_SKIP_INSTALL" = "1" ]; then
  warn "CODEX_SKIP_INSTALL=1 -> этап установки пропущен"
else
  if command -v corepack >/dev/null 2>&1 ; then
    corepack enable || true
    corepack prepare "pnpm@${PNPM_VERSION}" --activate || true
  fi

  if command -v pnpm >/dev/null 2>&1 ; then
    ok "corepack/pnpm активированы (target pnpm@$(pretty_pnpm_version "$PNPM_VERSION"))"

    if ! pnpm install --frozen-lockfile; then
      warn "pnpm install --frozen-lockfile упал"
      if [ "$CODEX_ALLOW_OVERRIDE_SANITIZE" = "1" ] && [ "$CODEX_SETUP_SAFE_MODE" != "1" ]; then
        warn "Разрешена санитария overrides (модифицирует package.json) — используйте только если точно нужно"
        node - <<'NODE'
const fs = require('fs'), path = require('path');
function walk(dir){
  const out=[];
  for (const it of fs.readdirSync(dir, {withFileTypes:true})){
    if(it.name==='node_modules' || it.name==='.git') continue;
    const full=path.join(dir,it.name);
    if(it.isDirectory()) out.push(...walk(full));
    else if(it.isFile() && it.name==='package.json') out.push(full);
  }
  return out;
}
for(const file of walk(process.cwd())){
  const txt = fs.readFileSync(file,'utf8');
  const pkg = JSON.parse(txt);
  if(!pkg.overrides) continue;
  const next = {};
  let changed = false;
  for(const [k,v] of Object.entries(pkg.overrides)){
    if(k.includes('>')) { next[k.split('>').pop().trim()] = v; changed = true; }
    else next[k] = v;
  }
  if(changed){
    fs.writeFileSync(file+'.bak_codex', txt, 'utf8');
    pkg.overrides = next;
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log('[codex] patched', file);
  }
}
NODE
        pnpm install --frozen-lockfile || pnpm install || true
      else
        warn "SAFE_MODE: санитария overrides отключена, fallback -> pnpm install (не frozen)"
        pnpm install || true
      fi
    fi
    ok "pnpm install завершён"
  else
    warn "pnpm не найден — fallback на npm (может не поддержать overrides в монорепо)"
    npm install --no-save --no-package-lock || true
  fi
fi

# --- 100% Mongo healthcheck (не пишет файлы) ---
progress 100 "Mongo healthcheck" "проверка соединения (masked), без записи файлов"
if [ -n "${MONGO_DATABASE_URL:-}" ] && command -v pnpm >/dev/null 2>&1 && [ -d "apps/api" ]; then
  trap - ERR
  set +e
  pnpm --dir apps/api exec node - <<'NODE'
const net = require('net');

const uri = process.env.MONGO_DATABASE_URL;
if (!uri) process.exit(0);

const masked = uri.replace(/\/\/.*@/,'//***:***@');
console.log('[codex-test] MONGO_DATABASE_URL set ->', masked);

let mongoose = null;
try { mongoose = require('mongoose'); } catch (_) { /* ignore */ }

(async () => {
  // 1) Full auth+ping when mongoose is available
  if (mongoose) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, tlsAllowInvalidCertificates: true });
      await mongoose.connection.db.admin().ping();
      await mongoose.disconnect();
      console.log('[codex-test] Mongo auth+ping OK');
      process.exit(0);
    } catch (e) {
      console.error('[codex-test] Mongo auth+ping FAILED:', e?.message || e);
      process.exit(1);
    }
  }

  // 2) TCP-only fallback (does not validate auth)
  try {
    const u = new URL(uri);
    const proto = String(u.protocol || '').toLowerCase();
    if (proto === 'mongodb+srv:') {
      console.log('[codex-test] SRV URI detected; TCP fallback not supported without DNS SRV resolve');
      process.exit(2);
    }
    const host = u.hostname;
    const port = Number(u.port || 27017);

    const s = net.connect({ host, port });
    s.setTimeout(8000);
    s.on('connect', () => { s.end(); console.log('[codex-test] TCP OK'); process.exit(0); });
    s.on('timeout', () => { s.destroy(); console.error('[codex-test] TCP TIMEOUT'); process.exit(1); });
    s.on('error',  (err) => { console.error('[codex-test] TCP ERROR:', err?.message || err); process.exit(1); });
  } catch {
    console.log('[codex-test] Could not parse MONGO_DATABASE_URL');
    process.exit(2);
  }
})();
NODE
  rc=$?
  set -e
  trap on_error ERR

  if [ "$rc" -eq 0 ]; then
    ok "Mongo healthcheck: OK"
  elif [ "$rc" -eq 2 ]; then
    warn "Mongo healthcheck: SKIPPED/UNSUPPORTED (SRV или некорректный URL)"
  else
    warn "Mongo healthcheck: failed (не фатально по умолчанию). Для строгого режима: CODEX_STRICT_MONGO_TEST=1"
    if [ "${CODEX_STRICT_MONGO_TEST:-0}" = "1" ]; then
      exit 1
    fi
  fi
else
  warn "Mongo healthcheck пропущен (нет MONGO_DATABASE_URL / pnpm / apps/api)"
fi

log "Summary:"
log "  repo_root=$REPO_ROOT"
log "  SAFE_MODE=${CODEX_SETUP_SAFE_MODE}"
log "  PATCH_ENSURE_BINARY=${CODEX_PATCH_ENSURE_BINARY}"
log "  ALLOW_OVERRIDE_SANITIZE=${CODEX_ALLOW_OVERRIDE_SANITIZE}"
log "  SKIP_INSTALL=${CODEX_SKIP_INSTALL}"
log "  USE_REAL_MONGO=${USE_REAL_MONGO:-false}"
log "  MONGOMS_SKIP_DOWNLOAD=${MONGOMS_SKIP_DOWNLOAD:-}"
if [ -n "${MONGO_DATABASE_URL:-}" ]; then
  log "  MONGO_DATABASE_URL=$(redact_mongo_uri "$MONGO_DATABASE_URL")"
fi

echo "==== codex_environment_setup.sh — end ===="

if [ "${__XTRACE_WAS_ON:-0}" -eq 1 ]; then
  set -x
fi
