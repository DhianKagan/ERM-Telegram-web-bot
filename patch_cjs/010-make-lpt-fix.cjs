#!/usr/bin/env node
const fs = require('fs');
let mk = fs.readFileSync('Makefile','utf8');

if (!mk.includes('.PHONY: lpt-fix')) {
  mk += `

.PHONY: lpt-fix
lpt-fix:
\tpnpm format || (echo "❌ format failed" && exit 1)
\t$(MAKE) lpt
`;
  fs.writeFileSync('Makefile', mk, 'utf8');
  console.log('[OK] Added lpt-fix target');
} else {
  console.log('[SKIP] lpt-fix already exists');
}
