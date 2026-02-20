#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-https://agromarket.up.railway.app}"
HEALTH_PATH="${HEALTH_PATH:-/api/monitor/health}"
METRICS_PATH="${METRICS_PATH:-/metrics}"
QUEUE_LAG_LIMIT_SECONDS="${QUEUE_LAG_LIMIT_SECONDS:-180}"
FAILED_JOBS_LIMIT="${FAILED_JOBS_LIMIT:-0}"

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

echo "==> Queue/worker sanity checks"
python3 - "$metrics_body" "$QUEUE_LAG_LIMIT_SECONDS" "$FAILED_JOBS_LIMIT" <<'PY'
import re
import sys
from collections import defaultdict
from typing import Dict, Optional

metrics_path = sys.argv[1]
lag_limit = float(sys.argv[2])
failed_limit = float(sys.argv[3])

line_re = re.compile(r'^(?P<name>[a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(?P<labels>[^}]*)\})?\s+(?P<value>[+-]?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)$')


def parse_labels(raw: Optional[str]) -> Dict[str, str]:
    if not raw:
        return {}
    labels: Dict[str, str] = {}
    for part in raw.split(','):
        key, _, value = part.partition('=')
        labels[key.strip()] = value.strip().strip('"')
    return labels


queue_lag: Dict[str, float] = defaultdict(float)
failed_jobs: Dict[str, float] = defaultdict(float)

with open(metrics_path, 'r', encoding='utf-8') as fh:
    for row in fh:
        line = row.strip()
        if not line or line.startswith('#'):
            continue
        match = line_re.match(line)
        if not match:
            continue

        name = match.group('name')
        labels = parse_labels(match.group('labels'))
        value = float(match.group('value'))

        if name == 'bullmq_queue_oldest_wait_seconds':
            queue = labels.get('queue', 'unknown')
            queue_lag[queue] = max(queue_lag[queue], value)
        elif name == 'bullmq_jobs_total' and labels.get('state') == 'failed':
            queue = labels.get('queue', 'unknown')
            failed_jobs[queue] += value

if not queue_lag:
    print('FAILED: no queue lag metrics found')
    sys.exit(1)

lag_violations = []
for queue, lag in sorted(queue_lag.items()):
    print(f'- queue lag {queue}: {lag:.2f}s (limit={lag_limit:.2f}s)')
    if lag > lag_limit:
        lag_violations.append((queue, lag))

failed_violations = []
if not failed_jobs:
    print('- failed jobs metrics: no queues with state=failed (ok)')
else:
    for queue, count in sorted(failed_jobs.items()):
        print(f'- failed jobs {queue}: {count:.0f} (limit={failed_limit:.0f})')
        if count > failed_limit:
            failed_violations.append((queue, count))

if lag_violations or failed_violations:
    if lag_violations:
        print('FAILED_LAG=' + ','.join(f'{q}:{v:.2f}' for q, v in lag_violations))
    if failed_violations:
        print('FAILED_JOBS=' + ','.join(f'{q}:{v:.0f}' for q, v in failed_violations))
    sys.exit(1)
PY

rm -f "$metrics_body"
echo "✅ quick stack validation passed"
