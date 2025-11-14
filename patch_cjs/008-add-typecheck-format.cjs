#!/usr/bin/env node
// patch: 008-add-typecheck-format.cjs
// purpose: добавить format:check и typecheck

const fs = require('fs');
const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

pkg.scripts ??= {};
pkg.scripts['format:check'] ??= 'prettier --check .';
pkg.scripts['typecheck'] ??= 'tsc --noEmit';

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
console.log('[OK] format:check и typecheck добавлены в package.json');
