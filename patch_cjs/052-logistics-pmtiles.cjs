#!/usr/bin/env node
// patch: 052-logistics-pmtiles.cjs
// purpose: регистрация PMTiles перед созданием карты и безопасный выбор стиля
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const patchPath = path.resolve(__dirname, '052-logistics-pmtiles.patch');
if (!fs.existsSync(patchPath)) {
  throw new Error('Файл патча не найден: ' + patchPath);
}

const patch = fs.readFileSync(patchPath, 'utf8');
if (!patch.trim()) {
  console.log('Нет изменений для применения');
  process.exit(0);
}

docsapply(patch);

function docsapply(patchContent) {
  execSync('git apply -', { stdio: 'inherit', input: patchContent });
}
