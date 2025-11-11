#!/usr/bin/env node
// patch: 016-prettier-ignore.cjs
// purpose: исключить служебные и генерируемые файлы из format:check
const fs = require('fs');
const path = '.prettierignore';
const rules = [
  'patch_cjs/**',
  'pnpm-lock.yaml',
  'package.json',
];
let cur = fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const set = new Set(cur.split(/\r?\n/).filter(Boolean));
let changed = false;
for (const r of rules) {
  if (!set.has(r)) { set.add(r); changed = true; }
}
if (changed) {
  fs.writeFileSync(path, Array.from(set).join('\n') + '\n', 'utf8');
  console.log('[OK] .prettierignore обновлён');
} else {
  console.log('[SKIP] .prettierignore уже содержит нужные правила');
}
