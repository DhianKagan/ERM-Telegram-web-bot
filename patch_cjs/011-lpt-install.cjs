#!/usr/bin/env node
// patch: 011-lpt-install.cjs
// purpose: добавить установку deps в make lpt
const fs = require('fs');
let mk = fs.readFileSync('Makefile','utf8');

if (!/lpt:/.test(mk)) {
  console.error('[ERR] target lpt не найден. Примените 006-make-lpt.cjs раньше.');
  process.exit(1);
}

// Вставляем pnpm install первой строкой рецепта lpt, если ещё нет
mk = mk.replace(
  /(\nlpt:\n)([^\S\r\n]*@?echo.*\n)?/m,
  (m, head, echoLine='') =>
    head +
    '\t# ensure deps installed for all workspaces\n' +
    '\tpnpm install --frozen-lockfile || pnpm install\n' +
    (echoLine || '')
);

fs.writeFileSync('Makefile', mk, 'utf8');
console.log('[OK] Makefile:lpt теперь делает pnpm install');
