#!/usr/bin/env node
// patch: 012-add-ts-node-to-api.cjs — добавить ts-node в apps/api
const fs = require('fs');
const path = 'apps/api/package.json';
if (!fs.existsSync(path)) {
  console.error('[ERR] apps/api/package.json not found');
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.devDependencies = pkg.devDependencies || {};
if (!pkg.devDependencies['ts-node']) {
  pkg.devDependencies['ts-node'] = '^10.9.2';
}
fs.writeFileSync(path, JSON.stringify(pkg, null, 2));
console.log('[OK] ts-node добавлен в apps/api/devDependencies');
