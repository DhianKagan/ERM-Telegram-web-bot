#!/usr/bin/env bash
set -euo pipefail
mkdir -p artifacts
echo "[ci:fast] lint → unit → build"
pnpm lint
pnpm test:unit
pnpm build -- --mode=ci
echo "[ci:fast] done"
