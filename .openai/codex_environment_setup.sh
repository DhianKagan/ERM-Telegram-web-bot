#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

echo "==== codex_environment_setup.sh — start ===="

# Helper: log
log() { echo ">>> $*"; }

# 1) Normalize http-proxy env -> HTTP_PROXY/HTTPS_PROXY
if [ ! -z "${http-proxy-}" ] 2>/dev/null; then
  log "Normalizing http-proxy -> HTTP_PROXY"
  export HTTP_PROXY="${http-proxy}"
  unset http-proxy
fi
if [ ! -z "${https-proxy-}" ] 2>/dev/null; then
  log "Normalizing https-proxy -> HTTPS_PROXY"
  export HTTPS_PROXY="${https-proxy}"
  unset https-proxy
fi

# 2) Ensure USE_REAL_MONGO set if MONGO_DATABASE_URL exists (priority)
if [ ! -z "${MONGO_DATABASE_URL-}" ]; then
  log "MONGO_DATABASE_URL found in environment. Enabling USE_REAL_MONGO=true"
  export USE_REAL_MONGO="true"
else
  # If not set, leave it unset (Codex/CI may set it later)
  log "MONGO_DATABASE_URL not present — tests will use mongodb-memory-server fallback by default"
fi

# 3) Sanitize MONGO_DATABASE_URL if present: remove accidental http:// before host, and add tls param for common proxy
if [ ! -z "${MONGO_DATABASE_URL-}" ]; then
  orig="$MONGO_DATABASE_URL"
  new="$orig"

  # remove '@http://' or '@http://' variant(s)
  # transform mongodb://user:pass@http://host:port/ -> mongodb://user:pass@host:port/
  new="$(echo "$new" | sed -E 's/@https?:\/\///@/g')"

  # If shinkansen.proxy.rlwy.net is used and tls not present, add tls=false
  if echo "$new" | grep -q "shinkansen.proxy.rlwy.net" && ! echo "$new" | grep -q -E "([&?])tls="; then
    log "Detected Railway TCP proxy host in MONGO_DATABASE_URL, adding tls=false"
    # If querystring exists: add &tls=false, else ?tls=false
    if echo "$new" | grep -q '\?'; then
      new="${new}&tls=false"
    else
      new="${new}?tls=false"
    fi
  fi

  # If up.railway.app host used and no tls param, ensure tls=true (safe)
  if echo "$new" | grep -q "\.up\.railway\.app" && ! echo "$new" | grep -q -E "([&?])tls="; then
    log "Detected .up.railway.app host in MONGO_DATABASE_URL, adding tls=true"
    if echo "$new" | grep -q '\?'; then
      new="${new}&tls=true"
    else
      new="${new}?tls=true"
    fi
  fi

  if [ "$new" != "$orig" ]; then
    log "Normalized MONGO_DATABASE_URL:"
    log "  before: $orig"
    log "  after : $new"
    export MONGO_DATABASE_URL="$new"
  else
    log "MONGO_DATABASE_URL looks OK."
  fi
fi

# 4) Prevent mongodb-memory-server binary download in CI if we use real Mongo
# Insert guard into scripts/ensure-mongodb-binary.mjs if it exists and not yet patched.
ENSURE_SCRIPT="scripts/ensure-mongodb-binary.mjs"
if [ -f "$ENSURE_SCRIPT" ]; then
  if ! grep -q "USE_REAL_MONGO" "$ENSURE_SCRIPT" 2>/dev/null; then
    log "Patching $ENSURE_SCRIPT to skip download when USE_REAL_MONGO=true..."
    cp "$ENSURE_SCRIPT" "$ENSURE_SCRIPT.bak_codex" || true
    # Insert guard at top of file
    awk 'BEGIN{print "// codex guard: skip mongodb binary download when USE_REAL_MONGO set"; print "if (process.env.USE_REAL_MONGO === \"true\") { console.log(\"[ensure-mongodb-binary] USE_REAL_MONGO=true — skipping mongodb binary download\"); process.exit(0); }"}{print}' "$ENSURE_SCRIPT.bak_codex" > "$ENSURE_SCRIPT"
    chmod +x "$ENSURE_SCRIPT" || true
  else
    log "$ENSURE_SCRIPT already contains USE_REAL_MONGO guard; skipping patch."
  fi
else
  log "$ENSURE_SCRIPT not found — skipping patch."
fi

# Also set environment variables to avoid downloads for mongodb-memory-server as fallback
export MONGOMS_SKIP_DOWNLOAD="true" || true
export MONGOMS_DOWNLOAD_MIRROR="" || true

# 5) Fix pnpm/npm overrides problem:
# Convert pnpm-specific overrides that use '>' syntax into npm-compatible keys (best-effort).
# We will scan package.json files and transform overrides keys like "pkgA>pkgB": "ver" -> "pkgB": "ver"
log "Scanning package.json files for pnpm-specific overrides with '>' and sanitizing..."

# Node script to safely transform JSON overrides
node - <<'NODE_SCRIPT'
const fs = require('fs');
const path = require('path');
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
const pkgs = findPackageJsons(root);
for (const file of pkgs) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const json = JSON.parse(raw);
    if (!json.overrides) continue;
    let changed = false;
    const overrides = json.overrides;
    const newOverrides = {};
    for (const k of Object.keys(overrides)) {
      if (k.includes('>')) {
        const parts = k.split('>');
        const newKey = parts[parts.length - 1].trim();
        if (!newOverrides[newKey] && !overrides[newKey]) {
          newOverrides[newKey] = overrides[k];
        } else {
          // conflict: prefer existing value; but if identical ignore
          if (JSON.stringify(overrides[newKey]) !== JSON.stringify(overrides[k])) {
            console.warn(`[codex] override conflict in ${file}: ${k} -> ${newKey} (kept existing)`);
          }
        }
        changed = true;
      } else {
        // keep original if not moved
        if (!(k in newOverrides)) newOverrides[k] = overrides[k];
      }
    }
    if (changed) {
      // merge in keys that were not changed
      for (const k of Object.keys(overrides)) {
        if (!(k in newOverrides)) newOverrides[k] = overrides[k];
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
NODE_SCRIPT

log "Overrides sanitization done."

# 6) Ensure corepack & pnpm available and install workspace deps:
log "Ensure corepack/pnpm and install workspace dependencies with pnpm -w install --frozen-lockfile"

# Activate pnpm via corepack
if command -v corepack >/dev/null 2>&1; then
  corepack enable || true
  # choose a stable pnpm version close to repo lockfile
  corepack prepare pnpm@10.29.3 --activate || true
else
  log "corepack not found — attempting pnpm directly"
fi

# Run pnpm workspace install
if command -v pnpm >/dev/null 2>&1; then
  log "Running pnpm -w install --frozen-lockfile"
  pnpm -w install --frozen-lockfile || {
    log "pnpm install failed — retry without --frozen-lockfile"
    pnpm -w install || true
  }
else
  log "pnpm not available — attempting npm install fallback"
  npm install --no-save --no-package-lock || true
fi

# 7) Export MONGOMS_SKIP_DOWNLOAD and mark USE_REAL_MONGO explicitly
export USE_REAL_MONGO="${USE_REAL_MONGO:-false}"
export MONGOMS_SKIP_DOWNLOAD="true"
log "USE_REAL_MONGO=${USE_REAL_MONGO} ; MONGOMS_SKIP_DOWNLOAD set to true"

# 8) Write a small test-mongo script for CI sanity check (safe, idempotent)
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
})();
NODE

chmod +x .openai/test-mongo.js || true

# 9) Final notes and diagnostics
log "Environment setup completed. Summary:"
log "  USE_REAL_MONGO=${USE_REAL_MONGO}"
if [ ! -z "${MONGO_DATABASE_URL-}" ]; then
  log "  MONGO_DATABASE_URL=${MONGO_DATABASE_URL}"
else
  log "  MONGO_DATABASE_URL not set"
fi

echo "==== codex_environment_setup.sh — end ===="
