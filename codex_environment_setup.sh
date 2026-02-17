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

log() { echo ">>> $*"; }
ok() { log "✅ OK: $*"; }
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

on_error() {
  local exit_code=$?
  echo ""
  log "❌ FAIL at: ${CURRENT_STEP}"
  log "Exit code: ${exit_code}"
  log "Подсказки:"
  log " - Проверь первую ошибку выше в логе."
  log " - Для локальной установки зависимостей: pnpm -w install"
  log " - Для ручной Mongo-проверки: pnpm --filter apps/api exec node -e \"require('mongoose').connect(process.env.MONGO_DATABASE_URL).then(()=>process.exit(0)).catch(()=>process.exit(1))\""
  exit "$exit_code"
}
trap on_error ERR

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
if [ ! -f "$REPO_ROOT/package.json" ]; then
  fail "Запускай скрипт из корня репозитория (рядом с package.json)."
fi
cd "$REPO_ROOT"

export CODEX_SETUP_SAFE_MODE="${CODEX_SETUP_SAFE_MODE:-1}"
export CODEX_PATCH_ENSURE_BINARY="${CODEX_PATCH_ENSURE_BINARY:-0}"
export CODEX_ALLOW_OVERRIDE_SANITIZE="${CODEX_ALLOW_OVERRIDE_SANITIZE:-0}"
export CODEX_SKIP_INSTALL="${CODEX_SKIP_INSTALL:-0}"
export CODEX_AUTO_INSTALL_API_PROD="${CODEX_AUTO_INSTALL_API_PROD:-0}"

echo "==== codex_environment_setup.sh — start ===="

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
export http_proxy="${http_proxy:-${HTTP_PROXY:-}}"
export https_proxy="${https_proxy:-${HTTPS_PROXY:-}}"

progress 25 "Mongo URL: проверка/нормализация" "включим USE_REAL_MONGO и поправим tls для Railway"
if [ -n "${MONGO_DATABASE_URL:-}" ]; then
  export USE_REAL_MONGO="true"
  orig="$MONGO_DATABASE_URL"
  new="$orig"
  new="${new//@http:\/\//@}"
  new="${new//@https:\/\//@}"

  if echo "$new" | grep -q "proxy.rlwy.net" && ! echo "$new" | grep -q -E "([&?])tls="; then
    new="${new}$(echo "$new" | grep -q '\?' && echo '&' || echo '?')tls=false"
    warn "Railway TCP proxy detected -> добавил tls=false"
  fi
  if echo "$new" | grep -q "\.up\.railway\.app" && ! echo "$new" | grep -q -E "([&?])tls="; then
    new="${new}$(echo "$new" | grep -q '\?' && echo '&' || echo '?')tls=true"
    warn ".up.railway.app detected -> добавил tls=true"
  fi

  export MONGO_DATABASE_URL="$new"
  ok "MONGO_DATABASE_URL=$(redact_mongo_uri "$MONGO_DATABASE_URL")"
else
  warn "MONGO_DATABASE_URL не задан — внешний Mongo не настроен"
fi

progress 40 "mongodb-memory-server" "запрет скачивания бинарников"
export MONGOMS_SKIP_DOWNLOAD="true"
export MONGOMS_DOWNLOAD_MIRROR="${MONGOMS_DOWNLOAD_MIRROR:-}"
ok "MONGOMS_SKIP_DOWNLOAD=true"

progress 55 "ensure-mongodb-binary guard" "безопасный режим по умолчанию"
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
      tail -n +2 "${ENSURE_SCRIPT}.bak_codex"
    } > "${ENSURE_SCRIPT}.tmp"
    mv "${ENSURE_SCRIPT}.tmp" "$ENSURE_SCRIPT"
    chmod +x "$ENSURE_SCRIPT" || true
    ok "Патч применён к $ENSURE_SCRIPT"
  else
    ok "Патч не требуется"
  fi
fi

progress 75 "pnpm: выбор версии" "берём версию из packageManager"
PNPM_VERSION_DEFAULT="10.29.3"
PNPM_VERSION="$PNPM_VERSION_DEFAULT"
if command -v node >/dev/null 2>&1; then
  PNPM_VERSION_FROM_PKG="$(node -p "(()=>{try{const pm=require('./package.json').packageManager||'';const m=String(pm).match(/^pnpm@(.+)$/);return m?m[1]:''}catch(e){return ''}})()")"
  if [ -n "${PNPM_VERSION_FROM_PKG:-}" ]; then
    PNPM_VERSION="$PNPM_VERSION_FROM_PKG"
  fi
fi
ok "pnpm target: $(pretty_pnpm_version "$PNPM_VERSION")"

progress 90 "Зависимости" "install с безопасными fallback"
if [ "$CODEX_SKIP_INSTALL" = "1" ]; then
  warn "CODEX_SKIP_INSTALL=1 -> этап установки пропущен"
else
  if command -v corepack >/dev/null 2>&1 ; then
    corepack enable || true
    corepack prepare "pnpm@${PNPM_VERSION}" --activate || true
  fi

  if command -v pnpm >/dev/null 2>&1 ; then
    if ! pnpm -w install --frozen-lockfile; then
      warn "pnpm --frozen-lockfile упал"
      if [ "$CODEX_ALLOW_OVERRIDE_SANITIZE" = "1" ] && [ "$CODEX_SETUP_SAFE_MODE" != "1" ]; then
        warn "Разрешена санитария overrides (модифицирует package.json)"
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
        pnpm -w install --frozen-lockfile || pnpm -w install || true
      else
        warn "SAFE_MODE: санитария overrides отключена, fallback -> pnpm -w install"
        pnpm -w install || true
      fi
    fi
  else
    warn "pnpm не найден — fallback на npm"
    npm install --no-save --no-package-lock || true
  fi
fi

progress 100 "Mongo healthcheck" "без записи файлов в репозиторий"
if [ -n "${MONGO_DATABASE_URL:-}" ] && [ -d "apps/api" ] && command -v pnpm >/dev/null 2>&1; then
  if [ "$CODEX_AUTO_INSTALL_API_PROD" = "1" ]; then
    pnpm --filter apps/api... -s install --frozen-lockfile --prod || pnpm --filter apps/api... -s install --prod || true
  else
    warn "AUTO_INSTALL_API_PROD отключён (CODEX_AUTO_INSTALL_API_PROD=0)"
  fi

  set +e
  pnpm --filter apps/api exec node - <<'NODE'
const net = require('net');
const uri = process.env.MONGO_DATABASE_URL;
if (!uri) process.exit(0);
let mongoose;
try { mongoose = require('mongoose'); } catch { mongoose = null; }
(async () => {
  if (mongoose) {
    try {
      const c = await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, tlsAllowInvalidCertificates: true });
      await c.connection.db.admin().ping();
      await mongoose.disconnect();
      console.log('[codex-test] Mongo auth+ping OK');
      process.exit(0);
    } catch (e) {
      console.error('[codex-test] Mongo auth+ping failed:', e?.message || e);
      process.exit(1);
    }
  }
  try {
    const u = new URL(uri);
    if (String(u.protocol).toLowerCase() === 'mongodb+srv:') process.exit(2);
    const s = net.connect({host: u.hostname, port: Number(u.port||27017)});
    s.setTimeout(8000);
    s.on('connect', ()=>{ s.end(); console.log('[codex-test] TCP OK'); process.exit(0);});
    s.on('timeout', ()=>{ s.destroy(); process.exit(1);});
    s.on('error', ()=>process.exit(1));
  } catch {
    process.exit(2);
  }
})();
NODE
  rc=$?
  set -e

  if [ "$rc" -eq 0 ]; then
    ok "Mongo healthcheck: OK"
  elif [ "$rc" -eq 2 ]; then
    warn "Mongo healthcheck: SKIPPED/UNSUPPORTED"
  else
    warn "Mongo healthcheck: failed (не фатально)"
    if [ "${CODEX_STRICT_MONGO_TEST:-0}" = "1" ]; then
      exit 1
    fi
  fi
else
  warn "Mongo healthcheck пропущен (нет MONGO_DATABASE_URL / apps/api / pnpm)"
fi

log "Summary:"
log "  SAFE_MODE=${CODEX_SETUP_SAFE_MODE}"
log "  PATCH_ENSURE_BINARY=${CODEX_PATCH_ENSURE_BINARY}"
log "  ALLOW_OVERRIDE_SANITIZE=${CODEX_ALLOW_OVERRIDE_SANITIZE}"
log "  SKIP_INSTALL=${CODEX_SKIP_INSTALL}"
log "  AUTO_INSTALL_API_PROD=${CODEX_AUTO_INSTALL_API_PROD}"
if [ -n "${MONGO_DATABASE_URL:-}" ]; then
  log "  MONGO_DATABASE_URL=$(redact_mongo_uri "$MONGO_DATABASE_URL")"
fi

echo "==== codex_environment_setup.sh — end ===="

if [ "${__XTRACE_WAS_ON:-0}" -eq 1 ]; then
  set -x
fi
