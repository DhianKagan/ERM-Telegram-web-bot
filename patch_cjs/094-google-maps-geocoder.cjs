#!/usr/bin/env node
// patch: 094-google-maps-geocoder.cjs
// purpose: обработать ссылки Google Maps и координаты в геокодере воркера
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const patchPath = path.resolve(__dirname, '094-google-maps-geocoder.patch');

if (!fs.existsSync(patchPath)) {
  throw new Error('Файл патча не найден: ' + patchPath);
}

const patch = fs.readFileSync(patchPath, 'utf8');

if (!patch.trim()) {
  console.log('Нет изменений для применения');
  process.exit(0);
}

execSync(`git apply "${patchPath}"`, { stdio: 'inherit' });
