#!/usr/bin/env node
// patch: 045-fix-map-config-path.cjs
// purpose: скорректировать импорт конфигурации карты для прокси mapLibrary

const fs = require('fs');
const path = require('path');

const target = path.resolve('apps/web/src/mapLibrary.ts');

const original = fs.readFileSync(target, 'utf8');
const updated = original.replace("../config/map", "./config/map");

if (original === updated) {
  console.log('no changes applied to ' + path.relative(process.cwd(), target));
  process.exit(0);
}

fs.writeFileSync(target, updated, 'utf8');
console.log('updated import in ' + path.relative(process.cwd(), target));
