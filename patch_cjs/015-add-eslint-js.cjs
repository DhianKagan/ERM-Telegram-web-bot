#!/usr/bin/env node
// patch: 015-add-eslint-js.cjs
// purpose: добавить @eslint/js (нужен для eslint.config.ts, ESLint v9)
const fs = require('fs');
const path = 'package.json';
const pkg = JSON.parse(fs.readFileSync(path,'utf8'));
pkg.devDependencies ||= {};
pkg.devDependencies['@eslint/js'] ||= '^9.14.0';
fs.writeFileSync(path, JSON.stringify(pkg,null,2));
console.log('[OK] devDep @eslint/js добавлен');
