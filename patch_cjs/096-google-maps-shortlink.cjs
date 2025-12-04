#!/usr/bin/env node
// patch: 096-google-maps-shortlink.cjs
// purpose: улучшить поддержку коротких ссылок Google Maps при геокодировании
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const patchPath = path.resolve(__dirname, '096-google-maps-shortlink.patch');

if (!fs.existsSync(patchPath)) {
  throw new Error('Файл патча не найден: ' + patchPath);
}

const patch = fs.readFileSync(patchPath, 'utf8');

if (!patch.trim()) {
  console.log('Нет изменений для применения');
  process.exit(0);
}

execSync(`git apply "${patchPath}"`, { stdio: 'inherit' });
