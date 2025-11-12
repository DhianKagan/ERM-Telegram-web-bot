#!/usr/bin/env node
// patch: 007-fix-codex-check.cjs
// purpose: добавить скрипт codex:check для make lpt

const fs = require('fs');
const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

if (!pkg.scripts) pkg.scripts = {};

pkg.scripts['codex:check'] = [
  'pnpm format:check',
  'pnpm lint',
  'pnpm typecheck',
  'pnpm audit',
].join(' && ');

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
console.log('[OK] codex:check добавлен в package.json');
