#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-https://agromarket.up.railway.app}"
HEALTH_PATH="${HEALTH_PATH:-/api/monitor/health}"
METRICS_PATH="${METRICS_PATH:-/metrics}"

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required" >&2
  exit 1
fi

HEALTH_URL="${API_BASE_URL%/}${HEALTH_PATH}"
METRICS_URL="${API_BASE_URL%/}${METRICS_PATH}"

echo "==> Health check: ${HEALTH_URL}"
health_body="$(mktemp)"
health_code="$(curl -sS -m 20 -o "$health_body" -w '%{http_code}' "$HEALTH_URL")"
if [[ "$health_code" != "200" ]]; then
  echo "ERROR: health endpoint returned HTTP ${health_code}" >&2
  cat "$health_body"
  rm -f "$health_body"
  exit 1
fi

python3 - "$health_body" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as f:
    payload = json.load(f)

checks = payload.get('checks', {})
required = ('s3', 'storage', 'redis', 'mongo', 'bullmq')
failed = []

print(f"status={payload.get('status')} timestamp={payload.get('timestamp')}")
for name in required:
    status = checks.get(name, {}).get('status')
    print(f"- {name}: {status}")
    if status != 'ok':
        failed.append(name)

if failed:
    print('FAILED_COMPONENTS=' + ','.join(failed))
    sys.exit(1)
PY
rm -f "$health_body"

echo "==> Metrics check: ${METRICS_URL}"
metrics_body="$(mktemp)"
metrics_code="$(curl -sS -m 20 -o "$metrics_body" -w '%{http_code}' "$METRICS_URL")"
if [[ "$metrics_code" != "200" ]]; then
  echo "ERROR: metrics endpoint returned HTTP ${metrics_code}" >&2
  rm -f "$metrics_body"
  exit 1
fi

required_metrics=(
  "bullmq_jobs_total"
  "bullmq_queue_oldest_wait_seconds"
  "bullmq_job_processing_duration_seconds"
  "disk_used_bytes"
  "osrm_precheck_failures_total"
)

missing=0
for metric in "${required_metrics[@]}"; do
  if rg -q "^# TYPE ${metric} " "$metrics_body" || rg -q "^${metric}(\{| )" "$metrics_body"; then
    echo "- ${metric}: present"
  else
    echo "- ${metric}: MISSING"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  rm -f "$metrics_body"
  exit 1
fi

# Optional sanity line for queue lag values.
if rg -q '^bullmq_queue_oldest_wait_seconds\{queue="logistics-routing"\}' "$metrics_body"; then
  echo "- bullmq_queue_oldest_wait_seconds{queue=\"logistics-routing\"}: present"
fi

rm -f "$metrics_body"
echo "✅ quick stack validation passed"
