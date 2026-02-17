#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

echo "==== codex_environment_setup.sh — start ===="

log() { echo ">>> $*"; }

# --- 1) Normalize proxy environment variables (support variants with dash/underscore/case) ---
normalize_proxies() {
  # HTTP proxy
  http_val="$(env | grep -i '^http[-_]*proxy=' | tail -n1 | cut -d= -f2- || true)"
  if [ -n "$http_val" ]; then
    export HTTP_PROXY="${HTTP_PROXY:-$http_val}"
    log "Normalized HTTP proxy -> HTTP_PROXY=${HTTP_PROXY}"
  fi

  # HTTPS proxy
  https_val="$(env | grep -i '^https[-_]*proxy=' | tail -n1 | cut -d= -f2- || true)"
  if [ -n "$https_val" ]; then
    export HTTPS_PROXY="${HTTPS_PROXY:-$https_val}"
    log "Normalized HTTPS proxy -> HTTPS_PROXY=${HTTPS_PROXY}"
  fi
}
normalize_proxies

# Also mirror HTTP_PROXY -> http_proxy and HTTPS_PROXY -> https_proxy for tools that check lowercase
export http_proxy="${http_proxy:-${HTTP_PROXY:-}}"
export https_proxy="${https_proxy:-${HTTPS_PROXY:-}}"

# --- 2) If MONGO_DATABASE_URL present, enable using real Mongo and sanitize it ---
if [ ! -z "${MONGO_DATABASE_URL-}" ]; then
  log "MONGO_DATABASE_URL found in environment. Enabling USE_REAL_MONGO=true"
  export USE_REAL_MONGO="true"

  orig="$MONGO_DATABASE_URL"
  new="$orig"

  # Remove accidental '@http://' or '@https://' after credentials (user:pass@http://host...)
  new="${new//@http:\/\//@}"
  new="${new//@https:\/\//@}"

  # If Railway TCP proxy host and no tls param, add tls=false (Compass / external connections)
  if echo "$new" | grep -q "proxy.rlwy.net" && ! echo "$new" | grep -q -E "([&?])tls="; then
    log "Detected Railway TCP proxy in MONGO_DATABASE_URL; adding tls=false"
    if echo "$new" | grep -q '\?'; then
      new="${new}&tls=false"
    else
      new="${new}?tls=false"
    fi
  fi

  # If public up.railway.app add tls=true if missing
  if echo "$new" | grep -q "\.up\.railway\.app" && ! echo "$new" | grep -q -E "([&?])tls="; then
    log "Detected .up.railway.app host in MONGO_DATABASE_URL; adding tls=true"
    if echo "$new" | grep -q '\?'; then
      new="${new}&tls=true"
    else
      new="${new}?tls=true"
    fi
  fi

  if [ "$new" != "$orig" ]; then
    log "Normalized MONGO_DATABASE_URL"
    log "  before: $orig"
    log "  after : $new"
    export MONGO_DATABASE_URL="$new"
  else
    log "MONGO_DATABASE_URL unchanged/ok"
  fi
else
  log "MONGO_DATABASE_URL not set (no external DB configured)"
fi

# --- 3) Prevent mongodb-memory-server from trying to download binaries in restricted network ---
# This avoids ENETUNREACH / download failures in CI where real DB is used.
export MONGOMS_SKIP_DOWNLOAD="true"
export MONGOMS_DOWNLOAD_MIRROR="${MONGOMS_DOWNLOAD_MIRROR:-}"
log "Set MONGOMS_SKIP_DOWNLOAD=${MONGOMS_SKIP_DOWNLOAD}"

# --- 4) Patch scripts/ensure-mongodb-binary.mjs to short-circuit when USE_REAL_MONGO=true ---
ENSURE_SCRIPT="scripts/ensure-mongodb-binary.mjs"
if [ -f "$ENSURE_SCRIPT" ]; then
  if ! grep -q "USE_REAL_MONGO" "$ENSURE_SCRIPT" 2>/dev/null; then
    log "Patching $ENSURE_SCRIPT to skip binary download when USE_REAL_MONGO=true..."
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
  else
    log "$ENSURE_SCRIPT already contains USE_REAL_MONGO guard; skipping patch."
  fi
else
  log "$ENSURE_SCRIPT not present; skipping patch."
fi

# --- 5) Try to sanitize problematic pnpm 'overrides' keys (best-effort) ---
log "Sanitizing package.json overrides that may contain '>' (automated best-effort)"
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
        } else {
          // keep existing if conflict
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
    }
  }catch(e){
    console.warn('[codex] skip', file, e.message);
  }
}
NODE

# --- 6) Ensure corepack/pnpm and install workspace deps ---
log "Ensure corepack/pnpm and run workspace install"
if command -v corepack >/dev/null 2>&1 ; then
  corepack enable || true
  corepack prepare pnpm@10.29.3 --activate || true
fi

if command -v pnpm >/dev/null 2>&1 ; then
  if ! pnpm -w install --frozen-lockfile; then
    log "pnpm install with frozen lockfile failed — retrying without frozen-lockfile"
    pnpm -w install || log "pnpm install failed (continuing)"
  fi
else
  log "pnpm not available; falling back to npm (may be slower / cause mismatch)"
  npm install --no-save --no-package-lock || log "npm install failed (continuing)"
fi

# --- 7) Create a small mongo connectivity test script ---
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

log "Environment setup finished. Summary:"
log "  USE_REAL_MONGO=${USE_REAL_MONGO:-false}"
log "  MONGOMS_SKIP_DOWNLOAD=${MONGOMS_SKIP_DOWNLOAD:-}"
if [ ! -z "${MONGO_DATABASE_URL-}" ]; then
  log "  MONGO_DATABASE_URL=${MONGO_DATABASE_URL}"
fi

echo "==== codex_environment_setup.sh — end ===="
