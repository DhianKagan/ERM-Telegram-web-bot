#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# ============================================================
# codex_environment_setup.sh
# - Pretty progress (%) with clear outcomes per step
# - Safe logging (redacts Mongo credentials)
# - Hardens against leaking secrets via xtrace (set -x)
# - Prints actionable troubleshooting hints on failure
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
  # usage: progress "70" "Doing something" "short expected outcome"
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

# Redact Mongo URI for logs (avoid leaking credentials / secrets)
redact_mongo_uri() {
  local uri="${1:-}"
  [ -z "$uri" ] && { echo ""; return 0; }
  # Mask credentials: mongodb(+srv)://user:pass@host -> mongodb(+srv)://***:***@host
  printf '%s' "$uri" | sed -E 's#(mongodb(\+srv)?://)([^/@]+)@#\1***:***@#I'
}

# Error handler with troubleshooting tips
on_error() {
  local exit_code=$?
  echo ""
  log "❌ FAIL at: ${CURRENT_STEP}"
  log "Exit code: ${exit_code}"
  echo ""
  log "Что делать дальше (быстрый чек-лист):"
  log "1) Пролистай логи выше — ищи первую ошибку (обычно она на пару строк выше)."
  log "2) Если упало на установке зависимостей:"
  log "   - Проверь прокси: должны быть строки про Normalized HTTP/HTTPS proxy."
  log "   - Повтори запуск (часто сетевые сбои временные)."
  log "   - Если lockfile конфликтует: скрипт уже делает retry без --frozen-lockfile."
  log "3) Если упало на Mongo:"
  log "   - Проверь, что MONGO_DATABASE_URL задан."
  log "   - Запусти тест: node .openai/test-mongo.js"
  log "   - Для Railway TCP proxy чаще нужен tls=false (скрипт добавляет автоматически)."
  echo ""
  log "Подсказка: если в логах вдруг появился полный Mongo URL, значит где-то включён set -x."
  log "Этот скрипт его выключает внутри себя, но если он 'source'-ится, проверь внешний runner."
  exit "$exit_code"
}
trap on_error ERR

# --- 1) Normalize proxy environment variables (support variants with dash/underscore/case) ---
progress 10 "Прокси: нормализация переменных" "все инструменты увидят HTTP_PROXY/HTTPS_PROXY"
normalize_proxies() {
  # HTTP proxy
  local http_val
  http_val="$(env | grep -i '^http[-_]*proxy=' | tail -n1 | cut -d= -f2- || true)"
  if [ -n "${http_val:-}" ]; then
    export HTTP_PROXY="${HTTP_PROXY:-$http_val}"
    ok "HTTP proxy -> HTTP_PROXY=${HTTP_PROXY}"
  else
    warn "HTTP proxy не найден в env (это нормально, если прокси не нужен)"
  fi

  # HTTPS proxy
  local https_val
  https_val="$(env | grep -i '^https[-_]*proxy=' | tail -n1 | cut -d= -f2- || true)"
  if [ -n "${https_val:-}" ]; then
    export HTTPS_PROXY="${HTTPS_PROXY:-$https_val}"
    ok "HTTPS proxy -> HTTPS_PROXY=${HTTPS_PROXY}"
  else
    warn "HTTPS proxy не найден в env (это нормально, если прокси не нужен)"
  fi
}
normalize_proxies

# Mirror uppercase -> lowercase for tools that check lowercase
export http_proxy="${http_proxy:-${HTTP_PROXY:-}}"
export https_proxy="${https_proxy:-${HTTPS_PROXY:-}}"
ok "Прокси переменные готовы (HTTP_PROXY/HTTPS_PROXY + http_proxy/https_proxy)"

# --- 2) If MONGO_DATABASE_URL present, enable using real Mongo and sanitize it ---
progress 25 "Mongo URL: проверка/нормализация" "включим USE_REAL_MONGO и поправим tls для Railway при необходимости"
if [ -n "${MONGO_DATABASE_URL+x}" ] && [ -n "${MONGO_DATABASE_URL:-}" ]; then
  ok "MONGO_DATABASE_URL найден — включаем реальный Mongo"
  export USE_REAL_MONGO="true"

  orig="$MONGO_DATABASE_URL"
  new="$orig"

  # Remove accidental '@http://' or '@https://' after credentials (user:pass@http://host...)
  new="${new//@http:\/\//@}"
  new="${new//@https:\/\//@}"

  # If Railway TCP proxy host and no tls param, add tls=false (Compass / external connections)
  if echo "$new" | grep -q "proxy.rlwy.net" && ! echo "$new" | grep -q -E "([&?])tls="; then
    warn "Railway TCP proxy detected -> добавляю tls=false"
    if echo "$new" | grep -q '\?'; then
      new="${new}&tls=false"
    else
      new="${new}?tls=false"
    fi
  fi

  # If public up.railway.app add tls=true if missing
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

# --- 3) Prevent mongodb-memory-server from trying to download binaries in restricted network ---
progress 40 "mongodb-memory-server: запрет скачивания бинарников" "избежим ENETUNREACH/скачиваний в CI"
export MONGOMS_SKIP_DOWNLOAD="true"
export MONGOMS_DOWNLOAD_MIRROR="${MONGOMS_DOWNLOAD_MIRROR:-}"
ok "MONGOMS_SKIP_DOWNLOAD=${MONGOMS_SKIP_DOWNLOAD}"

# --- 4) Patch scripts/ensure-mongodb-binary.mjs to short-circuit when USE_REAL_MONGO=true ---
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
  else
    ok "Guard уже есть — патч не нужен"
  fi
else
  warn "$ENSURE_SCRIPT не найден — пропускаю патч"
fi

# --- 5) Try to sanitize problematic pnpm 'overrides' keys (best-effort) ---
progress 70 "pnpm overrides: best-effort санитария" "уберём ключи с '>' (если ломают установку)"
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
        if(!newOverrides[newKey]) {
          newOverrides[newKey]=pkg.overrides[k];
        }
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
ok "override-санитария завершена"

# --- 6) Ensure corepack/pnpm and install workspace deps ---
progress 95 "Зависимости: установка" "corepack/pnpm + pnpm -w install (с retry без frozen при ошибке)"
if command -v corepack >/dev/null 2>&1 ; then
  corepack enable || true
  corepack prepare pnpm@10.29.3 --activate || true
  ok "corepack/pnpm активированы"
else
  warn "corepack не найден — продолжу как есть"
fi

if command -v pnpm >/dev/null 2>&1 ; then
  if pnpm -w install --frozen-lockfile; then
    ok "pnpm install --frozen-lockfile успешно"
  else
    warn "pnpm frozen install упал — retry без --frozen-lockfile"
    pnpm -w install || warn "pnpm install упал (продолжаю — но окружение может быть неполным)"
  fi
else
  warn "pnpm не найден — fallback на npm (может быть медленнее/с несовпадениями)"
  npm install --no-save --no-package-lock || warn "npm install упал (продолжаю — но окружение может быть неполным)"
fi

# --- 7) Create a small mongo connectivity test script ---
progress 100 "Финал: тест Mongo + summary" "можно руками проверить подключение"
mkdir -p .openai >/dev/null 2>&1 || true
cat > .openai/test-mongo.js <<'NODE'
const mongoose = require('mongoose');
(async () => {
  const uri = process.env.MONGO_DATABASE_URL;
  if (!uri) {
    console.log('[codex-test] MONGO_DATABASE_URL not set — skipping mongo connectivity test');
    process.exit(0);
  }
  console.log('[codex-test] Testing Mongo connection to', uri.replace(/\/\/.*@/,'//***:***@'));
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, tlsAllowInvalidCertificates: true });
    console.log('[codex-test] Connected to Mongo OK');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[codex-test] Mongo connection failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
NODE
chmod +x .openai/test-mongo.js || true
ok "Создан .openai/test-mongo.js (запуск: node .openai/test-mongo.js)"

log "Environment setup finished. Summary:"
log "  USE_REAL_MONGO=${USE_REAL_MONGO:-false}"
log "  MONGOMS_SKIP_DOWNLOAD=${MONGOMS_SKIP_DOWNLOAD:-}"
if [ -n "${MONGO_DATABASE_URL+x}" ] && [ -n "${MONGO_DATABASE_URL:-}" ]; then
  log "  MONGO_DATABASE_URL=$(redact_mongo_uri "$MONGO_DATABASE_URL")"
fi

echo "==== codex_environment_setup.sh — end ===="

# Restore xtrace if it was enabled before this script ran (important when script is sourced).
if [ "${__XTRACE_WAS_ON:-0}" -eq 1 ]; then
  set -x
fi
