#!/usr/bin/env node
const fs = require('fs');

const path = 'Makefile';
if (!fs.existsSync(path)) {
  console.error('[ERR] Makefile не найден');
  process.exit(1);
}

let mk = fs.readFileSync(path, 'utf8');

if (!/\.PHONY:.*\blpt-local\b/.test(mk)) {
  mk = mk.replace(/\.PHONY:([^\n]+)/, (line, targets) => {
    return `.PHONY:${targets} lpt-local`;
  });
}

if (!mk.includes('\nlpt-local:')) {
  mk += `\n\nlpt-local:\n\t# полный локальный прогон через pre_pr_check.sh\n\t./scripts/pre_pr_check.sh\n`;
}

fs.writeFileSync(path, mk, 'utf8');
console.log('[OK] Makefile: добавлена цель lpt-local');
