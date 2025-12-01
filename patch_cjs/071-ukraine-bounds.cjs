#!/usr/bin/env node
// patch: 071-ukraine-bounds.cjs
// purpose: обновление ограничений карты до прямоугольника Украины
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const patchPath = path.resolve(__dirname, '071-ukraine-bounds.patch');

if (!fs.existsSync(patchPath)) {
  throw new Error('Файл патча не найден: ' + patchPath);
}

const patch = fs.readFileSync(patchPath, 'utf8');

if (!patch.trim()) {
  console.log('Нет изменений для применения');
  process.exit(0);
}

typecheckPatchFormat(patch);

execSync('git apply -', {
  stdio: ['pipe', 'inherit', 'inherit'],
  input: patch,
});

function typecheckPatchFormat(content) {
  if (!content.startsWith('diff --git ')) {
    throw new Error('Некорректный формат патча');
  }
}
