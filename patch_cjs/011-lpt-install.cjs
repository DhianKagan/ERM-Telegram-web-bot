#!/usr/bin/env node
// patch: 011-lpt-install.cjs — добавить установку зависимостей в lpt
const fs = require('fs');
const p = 'Makefile';
if (!fs.existsSync(p)) { console.error('[ERR] Makefile not found'); process.exit(1); }
let s = fs.readFileSync(p,'utf8');

// вставляем строку установки deps сразу после "Running LPT..."
if (s.includes('Running LPT...') && !s.includes('pnpm install --frozen-lockfile')) {
  s = s.replace(
    /(Running LPT\.\.\.[^\n]*\n)(\t)/,
    `$1\tpnpm install --frozen-lockfile || pnpm install || (echo "❌ install failed" && exit 1)\n$2`
  );
}

fs.writeFileSync(p, s, 'utf8');
console.log('[OK] Makefile lpt: добавлен шаг установки зависимостей');
