#!/usr/bin/env node
const fs = require('fs');
let mk = fs.readFileSync('Makefile', 'utf8');

if (!mk.includes('.PHONY:')) mk += '\n.PHONY:\n';
mk = mk.replace(/\.PHONY:(.*)/, (_, rest) => `.PHONY:${rest} lpt`);

if (!mk.includes('lpt:')) {
  mk += `
\nlpt:
\t@echo "Running LPT..."
\tpnpm codex:check || (echo "❌ codex:check failed" && exit 1)
\tCI=true pnpm test:api || (echo "❌ unit tests failed" && exit 1)
\tCI=true pnpm build --filter shared --filter api --filter web --mode ci || (echo "❌ build failed" && exit 1)
\tCI=true pnpm test:e2e || (echo "❌ e2e tests failed" && exit 1)
\t@mkdir -p codex/reports && echo "# ✅ LPT passed – all checks OK." > codex/reports/lpt-summary.md
\t@echo "✅ Local Production Test passed."
`;
}

fs.writeFileSync('Makefile', mk);
console.log('[OK] Added lpt target to Makefile');
