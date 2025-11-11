#!/usr/bin/env node
// patch: 009-add-format-script.cjs
// purpose: добавить скрипт форматирования кода

const fs = require('fs');
const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

pkg.scripts ??= {};
pkg.scripts['format'] = 'prettier --write .';

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
console.log('[OK] format добавлен в package.json');
