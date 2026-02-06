#!/usr/bin/env bash
set -euo pipefail

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found in PATH. Install Node.js/npm first." >&2
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 not found in PATH. Install with: npm i -g pm2" >&2
  exit 1
fi

echo "Current versions:"
echo "  npm: $(npm -v)"
echo "  pm2: $(pm2 -v)"

echo ""
echo "Latest versions (from npm registry):"
latest_npm=$(npm view npm version)
latest_pm2=$(npm view pm2 version)

echo "  npm: ${latest_npm}"
echo "  pm2: ${latest_pm2}"

echo ""
echo "Safe update commands (run if you decide to update):"
echo "  npm i -g npm@${latest_npm}"
echo "  npm i -g pm2@${latest_pm2}"
