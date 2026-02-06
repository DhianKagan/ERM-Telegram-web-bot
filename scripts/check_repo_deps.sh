#!/usr/bin/env bash
set -euo pipefail

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found in PATH. Install with: npm i -g pnpm" >&2
  exit 1
fi

echo "Workspace dependency status (pnpm outdated):"
pnpm -r outdated || true

echo ""
echo "Security audit (pnpm audit):"
pnpm -w audit
