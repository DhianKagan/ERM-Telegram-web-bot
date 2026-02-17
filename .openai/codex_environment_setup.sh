--- File: .openai/codex_environment_setup.sh
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

echo "==== codex_environment_setup.sh — start ===="

log() { echo ">>> $*"; }

redact_mongo_url() {
  local uri="${1:-}"
  if [ -z "$uri" ]; then
    echo ""
    return 0
  fi
  # Redact credentials in:
  #  mongodb://user:pass@host/db
  #  mongodb+srv://user:pass@host/db
  echo "$uri" | sed -E 's#(mongodb(\+srv)?://)[^@/]+@#\1***:***@#'
}

# --- 1) Normalize proxy environment variables ---
# Some CI platforms set nonstandard names like "http-proxy" (with dash).
# We scan 'env' for these names and normalize to HTTP_PROXY/HTTPS_PROXY.
find_and_export_proxy() {
  local name_lower="$1" name_upper="$2"
  local val=""
  # check variants (dash and underscore, any case)
  val="$(env | grep -i '^http-proxy=' | tail -n1 | cut -d= -f2- || true)"
  if [ -z "$val" ]; then
    val="$(env | grep -i '^http_proxy=' | tail -n1 | cut -d= -f2- || true)"
  fi
  if [ -n "$val" ]; then
    export HTTP_PROXY="$val"
    log "Normalized proxy -> HTTP_PROXY=${HTTP_PROXY}"
  fi
}
find_and_export_proxy
# HTTPS
find_and_export_proxy_https() {
  local val=""
  val="$(env | grep -i '^https-proxy=' | tail -n1 | cut -d= -f2- || true)"
  if [ -z "$val" ]; then
    val="$(env | grep -i '^https_proxy=' | tail -n1 | cut -d= -f2- || true)"
  fi
  if [ -n "$val" ]; then
    export HTTPS_PROXY="$val"
    log "Normalized proxy -> HTTPS_PROXY=${HTTPS_PROXY}"
  fi
}
find_and_export_proxy_https

# --- 2) If MONGO_DATABASE_URL is present, enable USE_REAL_MONGO ---
if [ ! -z "${MONGO_DATABASE_URL-}" ]; then
  log "MONGO_DATABASE_URL found in environment. Enabling USE_REAL_MONGO=true"
  export USE_REAL_MONGO="true"
else
  log "MONGO_DATABASE_URL not present — mongodb-memory-server may be used as fallback"
fi

# --- 3) Sanitize MONGO_DATABASE_URL if present ---
if [ ! -z "${MONGO_DATABASE_URL-}" ]; then
  orig="$MONGO_DATABASE_URL"
  new="$orig"
  # Remove accidental '@http://' or '@https://' after user:pass@
  # Use sed with '#' delimiter to avoid escaping '/'
  new="$(echo "$new" | sed -E 's#@https?://#@#Ig')"

  # If Railway TCP proxy is present and no tls param, add tls=false
  if echo "$new" | grep -q "shinkansen.proxy.rlwy.net" && ! echo "$new" | grep -q -E "([&?])tls="; then
    log "Detected Railway TCP proxy host in MONGO_DATABASE_URL, adding tls=false"
    if echo "$new" | grep -q '?'; then
      new="${new}&tls=false"
    else
      new="${new}?tls=false"
    fi
  fi

  # If up.railway.app and no tls param -> add tls=true
  if echo "$new" | grep -q "\.up\.railway\.app" && ! echo "$new" | grep -q -E "([&?])tls="; then
    log "Detected .up.railway.app host in MONGO_DATABASE_URL, adding tls=true"
    if echo "$new" | grep -q '?'; then
      new="${new}&tls=true"
    else
      new="${new}?tls=true"
    fi
  fi

  if [ "$new" != "$orig" ]; then
    log "Normalized MONGO_DATABASE_URL"
    log "  before: $(redact_mongo_url "$orig")"
    log "  after : $(redact_mongo_url "$new")"
    export MONGO_DATABASE_URL="$new"
  else
    log "MONGO_DATABASE_URL looks OK."
  fi
fi

# --- 4) Patch scripts/ensure-mongodb-binary.mjs (skip download when USE_REAL_MONGO) ---
ENSURE_SCRIPT="scripts/ensure-mongodb-binary.mjs"
if [ -f "$ENSURE_SCRIPT" ]; then
  if ! grep -q "USE_REAL_MONGO" "$ENSURE_SCRIPT" 2>/dev/null; then
    log "Patching $ENSURE_SCRIPT to skip download when USE_REAL_MONGO=true..."
    cp "$ENSURE_SCRIPT" "$ENSURE_SCRIPT.bak_codex" || true
    # Insert a guard at the top of the script
    awk 'BEGIN{
      print "// codex guard: skip mongodb binary download when USE_REAL_MONGO set";
      print "if (process.env.USE_REAL_MONGO === \"true\") {";
      print "  console.log(\"[ensure-mongodb-binary] USE_REAL_MONGO=true — skipping mongodb binary download\");";
      print "  process.exit(0);";
      print "}";
    }
    {print}
    ' "$ENSURE_SCRIPT.bak_codex" > "$ENSURE_SCRIPT"
    chmod +x "$ENSURE_SCRIPT" || true
  else
    log "$ENSURE_SCRIPT already contains USE_REAL_MONGO guard; skipping patch."
  fi
else
  log "$ENSURE_SCRIPT not found — skipping patch."
fi

# Also set env vars to avoid downloads for mongodb-memory-server
export MONGOMS_SKIP_DOWNLOAD="true" || true
export MONGOMS_DOWNLOAD_MIRROR="" || true

# --- 5) Sanitize pnpm-specific overrides using Node (best-effort) ---
log "Scanning package.json files for pnpm-specific overrides (with '>') and attempting safe normalization..."
node - <<'NODE'
const fs = require('fs'), path = require('path');
function findPackageJsons(dir) {
  const out = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    if (it.name === 'node_modules' || it.name === '.git') continue;
    const full = path.join(dir, it.name);
    if (it.isDirectory()) {
      out.push(...findPackageJsons(full));
    } else if (it.isFile() && it.name === 'package.json') {
      out.push(full);
    }
  }
  return out;
}
const root = process.cwd();
const files = findPackageJsons(root);
for (const file of files) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const json = JSON.parse(raw);
    if (!json.overrides) continue;
    let changed = false;
    const overrides = json.overrides;
    const newOverrides = {};
    for (const key of Object.keys(overrides)) {
      if (key.includes('>')) {
        const parts = key.split('>');
        const newKey = parts[parts.length -1].trim();
        if (!newOverrides[newKey] && !overrides[newKey]) {
          newOverrides[newKey] = overrides[key];
        } else {
          if (JSON.stringify(overrides[newKey]) !== JSON.stringify(overrides[key])) {
            console.warn(`[codex] override conflict in ${file}: ${key} -> ${newKey} (kept existing)`);
          }
        }
        changed = true;
      } else {
        if (!(key in newOverrides)) newOverrides[key] = overrides[key];
      }
    }
    if (changed) {
      for (const key of Object.keys(overrides)) {
        if (!(key in newOverrides)) newOverrides[key] = overrides[key];
      }
      json.overrides = newOverrides;
      fs.writeFileSync(file + '.bak_codex', raw, 'utf8');
      fs.writeFileSync(file, JSON.stringify(json, null, 2), 'utf8');
      console.log(`[codex] patched overrides in ${file}`);
    }
  } catch (e) {
    console.warn(`[codex] failed processing ${file}: ${e.message}`);
  }
}
NODE

log "Overrides sanitization done."

# --- 6) Ensure corepack & pnpm, then install workspace deps ---
log "Ensuring corepack and pnpm (preferred for workspaces)..."
if command -v corepack >/dev/null 2>&1; then
  corepack enable || true
  corepack prepare pnpm@10.29.3 --activate || true
else
  log "corepack not found — try to proceed if pnpm is available"
fi

if command -v pnpm >/dev/null 2>&1; then
  log "Running pnpm -w install --frozen-lockfile"
  if ! pnpm -w install --frozen-lockfile; then
    log "pnpm -w install --frozen-lockfile failed; retrying without frozen lockfile"
    pnpm -w install || log "pnpm install failed (continuing)"
  fi
else
  log "pnpm not available — falling back to npm in root"
  npm install --no-save --no-package-lock || log "npm install failed (continuing)"
fi

# --- 7) Export final flags ---
export USE_REAL_MONGO="${USE_REAL_MONGO:-false}"
export MONGOMS_SKIP_DOWNLOAD="true"
log "USE_REAL_MONGO=${USE_REAL_MONGO} ; MONGOMS_SKIP_DOWNLOAD=${MONGOMS_SKIP_DOWNLOAD}"

# --- 8) Write check script for Mongo connectivity ---
cat > .openai/test-mongo.js <<'NODE'
const mongoose = require('mongoose');
(async () => {
  const uri = process.env.MONGO_DATABASE_URL;
  if (!uri) {
    console.log('[codex-test] MONGO_DATABASE_URL not set — skipping mongo check');
    process.exit(0);
  }
  console.log('[codex-test] Checking Mongo connectivity to', uri.replace(/\/\/.*@/, '//***:***@'));
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, tlsAllowInvalidCertificates: true });
    console.log('[codex-test] Connected OK');
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('[codex-test] Connect failed:', e.message || e);
    process.exit(1);
  }
