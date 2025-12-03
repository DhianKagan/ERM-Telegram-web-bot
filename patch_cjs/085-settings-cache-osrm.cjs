#!/usr/bin/env node
// patch: 085-settings-cache-osrm.cjs
// purpose: исправить ссылку на настройки, типизацию Redis-кеша и удалить следы устаревшего OSRM-хоста
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const patchPath = path.resolve(__dirname, '085-settings-cache-osrm.patch');
const legacyPatch = path.resolve(__dirname, '080-routing-url-update.patch');

if (fs.existsSync(legacyPatch)) {
  fs.rmSync(legacyPatch);
}

if (!fs.existsSync(patchPath)) {
  throw new Error('Файл патча не найден: ' + patchPath);
}

const patch = fs.readFileSync(patchPath, 'utf8');

if (!patch.trim()) {
  console.log('Нет изменений для применения');
  process.exit(0);
}

execSync('git apply -', { stdio: 'inherit', input: patch });
