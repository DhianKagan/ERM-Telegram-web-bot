#!/usr/bin/env node
// patch: 057-map-fallback-style.cjs
// purpose: исправить резервный стиль карты, чтобы MapLibre получал валидную спецификацию, а не URL тайла
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const patchPath = path.resolve(__dirname, '057-map-fallback-style.patch');
if (!fs.existsSync(patchPath)) {
  throw new Error('Файл патча не найден: ' + patchPath);
}

const patch = fs.readFileSync(patchPath, 'utf8');
if (!patch.trim()) {
  console.log('Нет изменений для применения');
  process.exit(0);
}

execSync('git apply -', { stdio: 'inherit', input: patch });
