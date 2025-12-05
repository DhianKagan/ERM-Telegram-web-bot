#!/usr/bin/env bash
set -euo pipefail

BASE="https://agromarket.up.railway.app"
PROXY="https://open-route-service-proxy-production.up.railway.app"
TOKEN="${1:-}"  # optionally pass X-Proxy-Token as first arg

echo "=== GET /api/v1/csrf ==="
curl -s -c cookies.txt -D headers.txt "${BASE}/api/v1/csrf" -o csrf.json
echo "Response headers saved to headers.txt, csrf.json saved"

if command -v jq >/dev/null 2>&1; then
  XSRF_TOKEN=$(jq -r .csrfToken csrf.json)
else
  XSRF_TOKEN=$(grep -oP '"csrfToken"\s*:\s*"\K[^"]+' csrf.json || true)
fi
echo "XSRF_TOKEN=${XSRF_TOKEN}"

echo -e "\n=== POST /api/v1/auth/login ==="
USER=${DEBUG_USER:-"your@example.com"}
PASS=${DEBUG_PASS:-"YOUR_PASSWORD"}
curl -v -b cookies.txt -c cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-XSRF-TOKEN: ${XSRF_TOKEN}" \
  -d "{\"username\":\"${USER}\",\"password\":\"${PASS}\"}" \
  "${BASE}/api/v1/auth/login" || true

echo -e "\nCookies file:"
cat cookies.txt

echo -e "\n=== Call API geometry (server) ==="
POINTS="30.708021,46.3939888;30.7124526,46.4206201"
ENC=$(python3 - <<PY
import urllib.parse,sys
print(urllib.parse.quote("${POINTS}"))
PY
)
curl -v -b cookies.txt "${BASE}/api/v1/route/geometry?points=${ENC}" || true

echo -e "\n=== Direct proxy test (with X-Proxy-Token) ==="
if [ -n "${TOKEN}" ]; then
  curl -v -H "X-Proxy-Token: ${TOKEN}" "${PROXY}/route/v1/driving/${POINTS}" || true
else
  echo "No X-Proxy-Token provided, skipping direct proxy test"
fi

echo -e "\n=== Done ==="
