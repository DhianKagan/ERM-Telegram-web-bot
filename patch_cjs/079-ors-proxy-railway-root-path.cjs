#!/usr/bin/env node
// patch: 079-ors-proxy-railway-root-path.cjs
// purpose: уточнить относительный путь Dockerfile для прокси OpenRouteService на Railway
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const patchPath = path.resolve(__dirname, '079-ors-proxy-railway-root-path.patch');

if (!fs.existsSync(patchPath)) {
  throw new Error('Файл патча не найден: ' + patchPath);
}

const patch = fs.readFileSync(patchPath, 'utf8');

if (!patch.trim()) {
  console.log('Нет изменений для применения');
  process.exit(0);
}

execSync('git apply -', {
  stdio: ['pipe', 'inherit', 'inherit'],
  input: patch,
});
