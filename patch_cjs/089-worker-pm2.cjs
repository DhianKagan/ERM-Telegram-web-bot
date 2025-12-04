#!/usr/bin/env node
// patch: 089-worker-pm2.cjs
// purpose: запуск воркера BullMQ вместе с API и обновление инструкции Railway
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const patchPath = path.resolve(__dirname, '089-worker-pm2.patch');

if (!fs.existsSync(patchPath)) {
  throw new Error('Файл патча не найден: ' + patchPath);
}

const patch = fs.readFileSync(patchPath, 'utf8');

if (!patch.trim()) {
  console.log('Нет изменений для применения');
  process.exit(0);
}

execSync('git apply -', { stdio: 'inherit', input: patch });
