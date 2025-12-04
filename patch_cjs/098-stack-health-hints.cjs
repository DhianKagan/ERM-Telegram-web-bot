#!/usr/bin/env node
// patch: 098-stack-health-hints.cjs
// purpose: уточнить подсказки healthcheck прокси и вывод подсказок в UI
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const patchPath = path.resolve(__dirname, '098-stack-health-hints.patch');

if (!fs.existsSync(patchPath)) {
  throw new Error('Файл патча не найден: ' + patchPath);
}

const patch = fs.readFileSync(patchPath, 'utf8');

if (!patch.trim()) {
  console.log('Нет изменений для применения');
  process.exit(0);
}

execSync(`git apply "${patchPath}"`, { stdio: 'inherit' });
