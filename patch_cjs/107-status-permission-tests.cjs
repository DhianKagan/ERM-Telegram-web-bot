#!/usr/bin/env node
// patch: 107-status-permission-tests.cjs
// purpose: обновление тестов прав смены статуса и покрытия adminOverride
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const patchPath = path.resolve(__dirname, '107-status-permission-tests.patch');

if (!fs.existsSync(patchPath)) {
  throw new Error('Файл патча не найден: ' + patchPath);
}

const patch = fs.readFileSync(patchPath, 'utf8');

if (!patch.trim()) {
  console.log('Нет изменений для применения');
  process.exit(0);
}

execSync('git apply -', { stdio: ['pipe', 'inherit', 'inherit'], input: patch });
