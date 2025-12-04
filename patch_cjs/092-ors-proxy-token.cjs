#!/usr/bin/env node
// patch: 092-ors-proxy-token.cjs
// purpose: добавить поддержку токена прокси в воркере и документацию по GEOCODER_URL
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const patchPath = path.resolve(__dirname, '092-ors-proxy-token.patch');

if (!fs.existsSync(patchPath)) {
  throw new Error('Файл патча не найден: ' + patchPath);
}

const patch = fs.readFileSync(patchPath, 'utf8');

if (!patch.trim()) {
  console.log('Нет изменений для применения');
  process.exit(0);
}

execSync('git apply -', { stdio: 'inherit', input: patch });
