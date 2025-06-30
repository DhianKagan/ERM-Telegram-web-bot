#!/usr/bin/env bash
# Назначение: установка TDWeb (TDLib в WebAssembly) для страницы `/chats`.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
if ! grep -q "tdweb" "$DIR/bot/web/package.json"; then
  npm --prefix "$DIR/bot/web" install tdweb
fi
mkdir -p "$DIR/bot/web/public/tdlib"
cp "$DIR/bot/web/node_modules/tdweb/dist"/* "$DIR/bot/web/public/tdlib/"

