#!/usr/bin/env node
// patch: 081-ors-proxy-ors-key-usage.cjs
// purpose: разъяснить использование ORS_BASE_URL и ORS_API_KEY в инструкции по прокси OpenRouteService
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const patchPath = path.resolve(__dirname, '081-ors-proxy-ors-key-usage.patch');

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
