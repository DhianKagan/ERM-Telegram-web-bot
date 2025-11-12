#!/usr/bin/env node
// patch: 012-add-ts-node.cjs
// purpose: добавить ts-node в devDependencies воркспейса
const fs = require('fs');
const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.devDependencies ||= {};
if (!pkg.devDependencies['ts-node']) {
  pkg.devDependencies['ts-node'] = '^10.9.2';
}
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
console.log('[OK] devDep ts-node добавлен в корень');
