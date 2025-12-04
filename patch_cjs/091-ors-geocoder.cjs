#!/usr/bin/env node
// patch: 091-ors-geocoder.cjs
// purpose: добавить поддержку OpenRouteService search в воркере и документировать ключ
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const patchPath = path.resolve(__dirname, '091-ors-geocoder.patch');

if (!fs.existsSync(patchPath)) {
  throw new Error('Файл патча не найден: ' + patchPath);
}

const patch = fs.readFileSync(patchPath, 'utf8');

if (!patch.trim()) {
  console.log('Нет изменений для применения');
  process.exit(0);
}

execSync(`git apply "${patchPath}"`, { stdio: 'inherit' });
