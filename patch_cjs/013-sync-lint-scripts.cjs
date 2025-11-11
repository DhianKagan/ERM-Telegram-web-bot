#!/usr/bin/env node
// patch: 013-sync-lint-scripts.cjs
// purpose: apps/api lint -> использовать ts-node/register (как apps/web)
const fs = require('fs');
const p = 'apps/api/package.json';
if (!fs.existsSync(p)) {
  console.log('[SKIP] apps/api/package.json не найден');
  process.exit(0);
}
const pkg = JSON.parse(fs.readFileSync(p,'utf8'));
pkg.scripts ||= {};
if (pkg.scripts.lint && pkg.scripts.lint.includes('--loader ts-node/esm')) {
  pkg.scripts.lint = pkg.scripts.lint.replace(
    /node\s+--loader\s+ts-node\/esm/,
    'node -r ./node_modules/ts-node/register'
  );
  fs.writeFileSync(p, JSON.stringify(pkg,null,2));
  console.log('[OK] apps/api: lint скрипт синхронизирован (ts-node/register)');
} else {
  console.log('[SKIP] apps/api: lint уже совместим или отсутствует');
}
