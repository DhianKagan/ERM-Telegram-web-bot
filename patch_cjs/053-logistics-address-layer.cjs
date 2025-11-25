#!/usr/bin/env node
// patch: 053-logistics-address-layer.cjs
// purpose: упорядочивание слоя адресов и проверка подключения PMTiles
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const patchPath = path.resolve(__dirname, '053-logistics-address-layer.patch');
if (!fs.existsSync(patchPath)) {
  throw new Error('Файл патча не найден: ' + patchPath);
}

const patch = fs.readFileSync(patchPath, 'utf8');
if (!patch.trim()) {
  console.log('Нет изменений для применения');
  process.exit(0);
}

execSync('git apply -', { stdio: 'inherit', input: patch });
