#!/usr/bin/env node
// patch: 024-web-disable-react-refresh.cjs
// purpose: отключить 'react-refresh/only-export-components' в lint:lpt (только для LPT)
const fs = require('fs');

function editJson(path, mut) {
  const j = JSON.parse(fs.readFileSync(path, 'utf8'));
  mut(j);
  fs.writeFileSync(path, JSON.stringify(j, null, 2));
}

const webPkgPath = 'apps/web/package.json';
editJson(webPkgPath, (pkg) => {
  pkg.scripts ||= {};
  // база как у вас (уже с --ignore-pattern и выключенным no-unused-expressions)
  const base = 'node -r ./node_modules/ts-node/register ./node_modules/eslint/bin/eslint.js -c ../../eslint.lpt.config.ts';
  pkg.scripts['lint:lpt'] =
    `${base} --ignore-pattern postcss.config.cjs ` +
    `--rule "@typescript-eslint/no-unused-expressions: off" ` +
    `--rule "react-refresh/only-export-components: off" .`;
});
console.log('[OK] apps/web lint:lpt: отключили react-refresh/only-export-components для LPT');
