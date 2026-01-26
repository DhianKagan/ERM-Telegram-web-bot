#!/usr/bin/env node
// patch: 114-remove-settings-tab-scrollbars.cjs
// purpose: hide scrollbars on settings tabs lists
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const patchPath = path.resolve(
  __dirname,
  '114-remove-settings-tab-scrollbars.patch',
);

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
