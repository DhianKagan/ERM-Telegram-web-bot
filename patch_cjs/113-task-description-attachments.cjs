#!/usr/bin/env node
// patch: 113-task-description-attachments.cjs
// purpose: attach inline files from task description to task attachments
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const patchPath = path.resolve(
  __dirname,
  '113-task-description-attachments.patch',
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
