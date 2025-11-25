#!/usr/bin/env node
// patch: 056-map-raster-fallback.cjs
// purpose: добавить резервный растровый стиль OSM и пробросить его в attachMapStyleFallback
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const patchPath = path.resolve(__dirname, '056-map-raster-fallback.patch');
if (!fs.existsSync(patchPath)) {
  throw new Error('Файл патча не найден: ' + patchPath);
}

const patch = fs.readFileSync(patchPath, 'utf8');
if (!patch.trim()) {
  console.log('Нет изменений для применения');
  process.exit(0);
}

execSync('git apply -', { stdio: 'inherit', input: patch });
