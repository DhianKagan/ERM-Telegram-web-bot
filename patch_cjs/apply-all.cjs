#!/usr/bin/env node
// Назначение файла: единый оркестратор для применения патчей в patch_cjs
// Основные модули: fs, path, child_process
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const selfName = path.basename(__filename);
const patchDir = __dirname;

const patches = fs
  .readdirSync(patchDir)
  .filter((name) => name.endsWith('.cjs') && name !== selfName)
  .sort();

patches.forEach((file) => {
  const fullPath = path.join(patchDir, file);
  console.log(`Применяем патч ${file}`);
  execFileSync('node', [fullPath], { stdio: 'inherit' });
});
