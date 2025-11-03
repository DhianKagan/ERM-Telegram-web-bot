#!/usr/bin/env bash
set -euo pipefail
mkdir -p artifacts artifacts/coverage
echo "[ci:full] lint → all tests → build → e2e"
pnpm lint
pnpm test
pnpm build -- --mode=ci
pnpm test:e2e
echo "[ci:full] done"
