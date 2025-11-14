#!/usr/bin/env node
// patch: 014-lpt-autofix.cjs
// purpose: добавить цель lpt-fix в Makefile: prettier --write . && make lpt
const fs = require('fs');
const path = 'Makefile';
if (!fs.existsSync(path)) {
  console.error('[ERR] Makefile not found');
  process.exit(1);
}
let mk = fs.readFileSync(path, 'utf8');
if (!mk.includes('\nlpt-fix:')) {
  mk += `

.PHONY: lpt-fix
lpt-fix:
\tpnpm prettier --write .
\t$(MAKE) lpt
`;
  fs.writeFileSync(path, mk, 'utf8');
  console.log('[OK] Makefile: добавлена цель lpt-fix');
} else {
  console.log('[SKIP] lpt-fix уже есть');
}
