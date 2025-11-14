#!/usr/bin/env node
// patch: 019-prettier-ignore-eslint-lpt.cjs
// purpose: исключить eslint.lpt.config.ts из prettier --check
const fs = require('fs');
const path = '.prettierignore';
const rule = 'eslint.lpt.config.ts';
let cur = fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const lines = new Set(cur.split(/\r?\n/).filter(Boolean));
if (!lines.has(rule)) {
  lines.add(rule);
  fs.writeFileSync(path, Array.from(lines).join('\n') + '\n', 'utf8');
  console.log('[OK] .prettierignore: добавлен eslint.lpt.config.ts');
} else {
  console.log('[SKIP] .prettierignore уже содержит eslint.lpt.config.ts');
}
