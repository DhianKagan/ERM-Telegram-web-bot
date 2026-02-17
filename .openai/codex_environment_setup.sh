#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# ============================================================
# codex_environment_setup.sh
# - Pretty progress (%) with clear outcomes per step
# - Safe logging (redacts credentials in Mongo/proxy URLs)
# - Disables xtrace (set -x) inside this script to avoid leaking secrets
# - Patches overrides only if install fails
# - Uses pnpm version from root package.json "packageManager" when possible
# - Mongo healthcheck runs in apps/api context and auto-recovers if mongoose isn't resolvable
# ============================================================

# Prevent leaking secrets via xtrace (set -x) in CI logs.
# Preserve previous xtrace state and restore it at the end.
__XTRACE_WAS_ON=0
case "$-" in
  *x*) __XTRACE_WAS_ON=1; set +x ;;
esac

echo "==== codex_environment_setup.sh — start ===="

log() { echo ">>> $*"; }

# ----- Pretty progress helpers -----
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
ok()   { log "✅ OK: $*"; }
warn() { log "⚠️  $*"; }

# ----- Timing helpers -----
declare -A __TS=()
declare -A __DUR=()
time_start() { __TS["$1"]="$(date +%s)"; }
time_end() {
  local k="$1"
  local now; now="$(date +%s)"
  local start="${__TS[$k]:-0}"
  if [ "$start" -gt 0 ]; then
    __DUR["$k"]=$(( now - start ))
  fi
}

# ----- Redaction helpers -----
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

# ----- Change tracking -----
CHANGED_ITEMS=()
record_change() { CHANGED_ITEMS+=("$1"); }

# Error handler with actionable troubleshooting
on_error() {
  local exit_code=$?
  echo ""
  log "❌ FAIL at: ${CURRENT_STEP}"
  log "Exit code: ${exit_code}"
  echo ""
  log "Что делать дальше (быстрый чек-лист):"
  log "1) Найди первую ошибку выше (часто она на 1–20 строк выше последней)."
  log "2) Если упало на установке зависимостей:"
  log "   - Проверь прокси (должны быть строки про HTTP_PROXY/HTTPS_PROXY)."
  log "   - Повтори запуск (сетевые сбои часто временные)."
  log "   - Попробуй вручную: pnpm -w install"
  log "3) Если ругается, что не находится mongoose:"
  log "   - Запусти: pnpm --filter apps/api... install --frozen-lockfile --prod"
  log "4) Если проблемы с Mongo:"
  log "   - Запусти: pnpm --filter apps/api exec node .openai/test-mongo.js"
  log "   - Для Railway TCP proxy обычно нужен tls=false (скрипт добавляет автоматически)."
  echo ""
  log "Подсказка: если где-то в логах появился полный секрет, значит вне этого скрипта включён set -x."
  exit "$exit_code"
}
trap on_error ERR

ROOT_DIR="$(pwd)"
API_DIR="apps/api"

# Can a module be resolved as if from apps/api?
can_resolve_from_api() {
  local module_name="$1"
  node -e "require.resolve('${module_name}', { paths: ['${ROOT_DIR}/${API_DIR}'] })" >/dev/null 2>&1
}

# --- 1) Normalize proxy environment variables ---
time_start "proxy"
progress 10 "Прокси: нормализация переменных" "все инструменты увидят HTTP_PROXY/HTTPS_PROXY"
normalize_proxies() {
  local http_val
  http_val="$(env | grep -i '^http[-_]*proxy=' | tail -n1 | cut -d= -f2- || true)"
  if [ -n "${http_val:-}" ]; then
    export HTTP_PROXY="${HTTP_PROXY:-$http_val}"
    ok "HTTP proxy -> HTTP_PROXY=$(redact_uri_credentials "$HTTP_PROXY")"
  else
    warn "HTTP proxy не найден в env (нормально, если прокси не нужен)"
  fi

  local https_val
  https_val="$(env | grep -i '^https[-_]*proxy=' | tail -n1 | cut -d= -f2- || true)"
  if [ -n "${https_val:-}" ]; then
    export HTTPS_PROXY="${HTTPS_PROXY:-$https_val}"
    ok "HTTPS proxy -> HTTPS_PROXY=$(redact_uri_credentials "$HTTPS_PROXY")"
  else
    warn "HTTPS proxy не найден в env (нормально, если прокси не нужен)"
  fi
}
normalize_proxies

export http_proxy="${http_proxy:-${HTTP_PROXY:-}}"
export https_proxy="${https_proxy:-${HTTPS_PROXY:-}}"
ok "Прокси переменные готовы (HTTP_PROXY/HTTPS_PROXY + http_proxy/https_proxy)"
time_end "proxy"

# --- 2) If MONGO_DATABASE_URL present, enable using real Mongo and sanitize it ---
time_start "mongo_norm"
progress 25 "Mongo URL: проверка/нормализация" "включим USE_REAL_MONGO и поправим tls для Railway при необходимости"
if [ -n "${MONGO_DATABASE_URL+x}" ] && [ -n "${MONGO_DATABASE_URL:-}" ]; then
  ok "MONGO_DATABASE_URL найден — включаем реальный Mongo"
  export USE_REAL_MONGO="true"

  orig="$MONGO_DATABASE_URL"
  new="$orig"

  new="${new//@http:\/\//@}"
  new="${new//@https:\/\//@}"

  if echo "$new" | grep -q "proxy.rlwy.net" && ! echo "$new" | grep -q -E "([&?])tls="; then
    warn "Railway TCP proxy detected -> добавляю tls=false"
    if echo "$new" | grep -q '\?'; then
      new="${new}&tls=false"
    else
      new="${new}?tls=false"
    fi
  fi

  if echo "$new" | grep -q "\.up\.railway\.app" && ! echo "$new" | grep -q -E "([&?])tls="; then
    warn ".up.railway.app detected -> добавляю tls=true"
    if echo "$new" | grep -q '\?'; then
      new="${new}&tls=true"
    else
      new="${new}?tls=true"
    fi
  fi

  if [ "$new" != "$orig" ]; then
    ok "Mongo URL нормализован"
    log "   before: $(redact_mongo_uri "$orig")"
    log "   after : $(redact_mongo_uri "$new")"
    export MONGO_DATABASE_URL="$new"
  else
    ok "Mongo URL уже корректный (без изменений)"
  fi
else
  warn "MONGO_DATABASE_URL не задан — внешний Mongo не настроен (это ок, если не нужен)"
fi
time_end "mongo_norm"

# --- 3) Prevent mongodb-memory-server from trying to download binaries ---
time_start "mongoms"
progress 40 "mongodb-memory-server: запрет скачивания бинарников" "избежим ENETUNREACH/скачиваний в CI"
export MONGOMS_SKIP_DOWNLOAD="true"
export MONGOMS_DOWNLOAD_MIRROR="${MONGOMS_DOWNLOAD_MIRROR:-}"
ok "MONGOMS_SKIP_DOWNLOAD=${MONGOMS_SKIP_DOWNLOAD}"
time_end "mongoms"

# --- 4) Patch scripts/ensure-mongodb-binary.mjs ---
time_start "ensure_patch"
progress 55 "Патч: ensure-mongodb-binary.mjs" "при USE_REAL_MONGO=true не будем ничего скачивать"
ENSURE_SCRIPT="scripts/ensure-mongodb-binary.mjs"
if [ -f "$ENSURE_SCRIPT" ]; then
  if ! grep -q "USE_REAL_MONGO" "$ENSURE_SCRIPT" 2>/dev/null; then
    ok "Патчу $ENSURE_SCRIPT (добавляю guard)"
    cp "$ENSURE_SCRIPT" "${ENSURE_SCRIPT}.bak_codex" || true
    {
      echo "// codex guard: skip mongodb binary download when USE_REAL_MONGO set";
      echo "if (process.env.USE_REAL_MONGO === 'true') {";
      echo "  console.log('[ensure-mongodb-binary] USE_REAL_MONGO=true — skipping mongodb binary download');";
      echo "  process.exit(0);";
      echo "}";
      echo ""
      cat "${ENSURE_SCRIPT}.bak_codex"
    } > "${ENSURE_SCRIPT}.tmp" && mv "${ENSURE_SCRIPT}.tmp" "$ENSURE_SCRIPT"
    chmod +x "$ENSURE_SCRIPT" || true
    ok "Патч применён"
    record_change "Patched ${ENSURE_SCRIPT} (backup: ${ENSURE_SCRIPT}.bak_codex)"
  else
    ok "Guard уже есть — патч не нужен"
  fi
else
  warn "$ENSURE_SCRIPT не найден — пропускаю патч"
fi
time_end "ensure_patch"

# --- 5/6) Ensure corepack/pnpm and install workspace deps ---
time_start "install"

progress 75 "pnpm: выбор версии" "берём из package.json packageManager, чтобы совпадало с репозиторием"
PNPM_VERSION_DEFAULT="10.29.3"
PNPM_VERSION="$PNPM_VERSION_DEFAULT"
if command -v node >/dev/null 2>&1; then
  PNPM_VERSION_FROM_PKG="$(node -p "(()=>{try{const pm=require('./package.json').packageManager||'';const m=String(pm).match(/^pnpm@(.+)$/);return m?m[1]:''}catch(e){return ''}})()")"
  if [ -n "${PNPM_VERSION_FROM_PKG:-}" ]; then
    PNPM_VERSION="$PNPM_VERSION_FROM_PKG"
    ok "pnpm версия из package.json: $(pretty_pnpm_version "$PNPM_VERSION")"
  else
    warn "packageManager не найден/не pnpm — использую дефолт: ${PNPM_VERSION_DEFAULT}"
  fi
else
  warn "node не найден — не могу прочитать packageManager; использую дефолт: ${PNPM_VERSION_DEFAULT}"
fi

progress 95 "Зависимости: установка" "corepack/pnpm + pnpm -w install (патчим overrides только если упадёт)"
if command -v corepack >/dev/null 2>&1 ; then
  corepack enable || true
  corepack prepare "pnpm@${PNPM_VERSION}" --activate || true
  ok "corepack/pnpm активированы (target pnpm@$(pretty_pnpm_version "$PNPM_VERSION"))"
else
  warn "corepack не найден — продолжу как есть"
fi

sanitize_overrides_if_needed() {
  progress 85 "pnpm overrides: санитария (только при фейле install)" "пытаемся убрать ключи с '>'"
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
const files = walk(process.cwd());
let patched = 0;
for(const file of files){
  try{
    const txt = fs.readFileSync(file,'utf8');
    const pkg = JSON.parse(txt);
    if(!pkg.overrides) continue;
    const keys = Object.keys(pkg.overrides);
    let changed=false;
    const newOverrides = {};
    for(const k of keys){
      if(k.includes('>')){
        const parts = k.split('>');
        const newKey = parts[parts.length-1].trim();
        if(!newOverrides[newKey]) newOverrides[newKey]=pkg.overrides[k];
        changed=true;
      } else {
        newOverrides[k]=pkg.overrides[k];
      }
    }
    if(changed){
      pkg.overrides = newOverrides;
      fs.writeFileSync(file+'.bak_codex', txt, 'utf8');
      fs.writeFileSync(file, JSON.stringify(pkg, null, 2), 'utf8');
      console.log('[codex] patched overrides in', file);
      patched++;
    }
  }catch(e){
    console.warn('[codex] skip', file, e.message);
  }
}
console.log('[codex] overrides patch summary:', patched, 'file(s) updated');
NODE
  ok "override-санитария завершена (если были изменения — созданы *.bak_codex)"
}

if command -v pnpm >/dev/null 2>&1 ; then
  if pnpm -w install --frozen-lockfile; then
    ok "pnpm install --frozen-lockfile успешно"
  else
    warn "pnpm install --frozen-lockfile упал — попробую самоисцеление"
    sanitize_overrides_if_needed

    if pnpm -w install --frozen-lockfile; then
      ok "pnpm install --frozen-lockfile успешно после санитарии overrides"
    else
      warn "повторный frozen install всё ещё падает — retry без --frozen-lockfile"
      pnpm -w install || warn "pnpm install упал (продолжаю — но окружение может быть неполным)"
    fi
  fi
else
  warn "pnpm не найден — fallback на npm"
  npm install --no-save --no-package-lock || warn "npm install упал (продолжаю — но окружение может быть неполным)"
fi
time_end "install"

# --- 7) Create a mongo connectivity test script inside apps/api ---
time_start "mongo_test"
progress 100 "Финал: тест Mongo + summary" "тест в apps/api + авто-восстановление mongoose + TCP-fallback"

API_TEST_DIR="${API_DIR}/.openai"
API_TEST_SCRIPT="${API_TEST_DIR}/test-mongo.js"

if [ -d "$API_DIR" ]; then
  mkdir -p "$API_TEST_DIR" >/dev/null 2>&1 || true

  cat > "$API_TEST_SCRIPT" <<'NODE'
/**
 * Mongo connectivity test:
 * 1) Prefer real auth ping via mongoose (if available)
 * 2) If mongoose isn't available, fallback to TCP connect to host:port (network sanity)
 */
const net = require('net');

function mask(uri) {
  return String(uri || '').replace(/\/\/.*@/,'//***:***@');
}

function tcpCheckMongo(uri) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(uri); } catch (e) { return reject(new Error('URL parse failed')); }

    if (u.protocol && String(u.protocol).toLowerCase() === 'mongodb+srv:') {
      return reject(new Error('mongodb+srv cannot be TCP-checked without SRV resolution'));
    }

    const host = u.hostname;
    const port = Number(u.port || 27017);

    if (!host) return reject(new Error('No hostname in URL'));

    const sock = net.connect({ host, port });
    sock.setTimeout(8000);

    sock.on('connect', () => {
      sock.end();
      resolve({ host, port });
    });
    sock.on('timeout', () => {
      sock.destroy();
      reject(new Error('TCP timeout'));
    });
    sock.on('error', (err) => reject(err));
  });
}

(async () => {
  const uri = process.env.MONGO_DATABASE_URL;
  if (!uri) {
    console.log('[codex-test] MONGO_DATABASE_URL not set — skipping mongo connectivity test');
    process.exit(0);
  }

  console.log('[codex-test] Testing Mongo connection to', mask(uri));

  let mongoose = null;
  try {
    mongoose = require('mongoose');
  } catch (e) {
    mongoose = null;
  }

  if (!mongoose) {
    console.warn('[codex-test] mongoose not found — falling back to TCP check (network only, no auth check)');
    try {
      const { host, port } = await tcpCheckMongo(uri);
      console.log(`[codex-test] TCP OK to ${host}:${port}`);
      // 0 = success, but note: auth not tested
      process.exit(0);
    } catch (err) {
      console.error('[codex-test] TCP check failed:', err && err.message ? err.message : err);
      // 2 = "skipped/unsupported" if it’s srv or parse issues, 1 otherwise
      const msg = String(err && err.message ? err.message : err);
      if (/mongodb\+srv/i.test(msg) || /parse failed/i.test(msg)) process.exit(2);
      process.exit(1);
    }
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      tlsAllowInvalidCertificates: true,
    });

    const db = conn.connection && conn.connection.db;
    if (db && db.admin && typeof db.admin().ping === 'function') {
      await db.admin().ping();
    }

    console.log('[codex-test] Connected to Mongo OK (auth + ping)');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[codex-test] Mongo connection failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
NODE

  chmod +x "$API_TEST_SCRIPT" || true
  ok "Создан ${API_TEST_SCRIPT}"
  ok "Запуск вручную: pnpm --filter apps/api exec node .openai/test-mongo.js"
  record_change "Created ${API_TEST_SCRIPT}"
else
  warn "Не найден каталог ${API_DIR} — пропускаю создание mongo test"
fi

# --- Optional auto-run (non-fatal by default) ---
if [ -n "${MONGO_DATABASE_URL+x}" ] && [ -n "${MONGO_DATABASE_URL:-}" ] && [ -d "$API_DIR" ] && command -v pnpm >/dev/null 2>&1 ; then
  log "[healthcheck] MONGO_DATABASE_URL задан — проверяю, резолвится ли mongoose из apps/api"

  if ! can_resolve_from_api "mongoose"; then
    warn "mongoose не резолвится из apps/api — делаю точечный install для apps/api (как в Railway start.sh)"
    if pnpm --filter apps/api... -s install --frozen-lockfile --prod; then
      ok "apps/api prod-зависимости установлены (ожидаю, что mongoose появится)"
    else
      warn "apps/api prod install с frozen упал — retry без frozen"
      pnpm --filter apps/api... -s install --prod || warn "apps/api prod install упал (продолжаю)"
    fi
  else
    ok "mongoose резолвится из apps/api — отлично"
  fi

  log "[healthcheck] Запускаю тест подключения (masked)"
  set +e
  pnpm --filter apps/api exec node .openai/test-mongo.js
  rc=$?
  set -e

  if [ "$rc" -eq 0 ]; then
    ok "Mongo healthcheck: OK"
  elif [ "$rc" -eq 2 ]; then
    warn "Mongo healthcheck: SKIPPED/UNSUPPORTED (например mongodb+srv без SRV-resolve или URL parse issue)"
    warn "Совет: поставь/восстанови mongoose в apps/api deps или используй стандартный check:mongo из проекта"
  else
    warn "Mongo healthcheck: подключение НЕ удалось"
    log "Подсказки:"
    log " - Проверь правильность MONGO_DATABASE_URL (user/pass/host/port/db/authSource)."
    log " - Для Railway TCP proxy обычно нужен tls=false (у тебя он добавляется)."
    log " - Если сеть/прокси режет доступ: проверь HTTP(S)_PROXY."
    if [ "${CODEX_STRICT_MONGO_TEST:-0}" = "1" ]; then
      log "CODEX_STRICT_MONGO_TEST=1 -> считаю это ошибкой"
      exit 1
    else
      warn "Продолжаю (по умолчанию healthcheck не фатален). Для строгого режима: CODEX_STRICT_MONGO_TEST=1"
    fi
  fi
else
  log "[healthcheck] Пропуск авто-теста (нет MONGO_DATABASE_URL или pnpm, либо нет apps/api)"
fi
time_end "mongo_test"

# ----- Summary -----
log "Environment setup finished. Summary:"
log "  USE_REAL_MONGO=${USE_REAL_MONGO:-false}"
log "  MONGOMS_SKIP_DOWNLOAD=${MONGOMS_SKIP_DOWNLOAD:-}"
if [ -n "${MONGO_DATABASE_URL+x}" ] && [ -n "${MONGO_DATABASE_URL:-}" ]; then
  log "  MONGO_DATABASE_URL=$(redact_mongo_uri "$MONGO_DATABASE_URL")"
fi

log "Timings (sec):"
log "  proxy          : ${__DUR[proxy]:-0}"
log "  mongo_norm     : ${__DUR[mongo_norm]:-0}"
log "  mongoms        : ${__DUR[mongoms]:-0}"
log "  ensure_patch   : ${__DUR[ensure_patch]:-0}"
log "  install        : ${__DUR[install]:-0}"
log "  mongo_test     : ${__DUR[mongo_test]:-0}"

if [ "${#CHANGED_ITEMS[@]}" -gt 0 ]; then
  log "Changes applied:"
  for item in "${CHANGED_ITEMS[@]}"; do
    log "  - $item"
  done
else
  log "Changes applied: none"
fi

echo "==== codex_environment_setup.sh — end ===="

# Restore xtrace if it was enabled before this script ran.
if [ "${__XTRACE_WAS_ON:-0}" -eq 1 ]; then
  set -x
fi
