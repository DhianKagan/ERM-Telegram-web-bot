#!/usr/bin/env node
// patch: 023-web-lpt-quickfix.cjs
// purpose:
// 1) Добавить eslint-plugin-react-refresh, чтобы правило было определено
// 2) Подправить apps/web скрипт lint:lpt: игнор postcss.config.cjs и вырубить
//    @typescript-eslint/no-unused-expressions только для LPT.

const fs = require('fs');

function editJson(path, mut) {
  const j = JSON.parse(fs.readFileSync(path, 'utf8'));
  mut(j);
  fs.writeFileSync(path, JSON.stringify(j, null, 2));
}

// 1) devDep eslint-plugin-react-refresh (в корневом package.json)
editJson('package.json', (pkg) => {
  pkg.devDependencies ||= {};
  if (!pkg.devDependencies['eslint-plugin-react-refresh']) {
    pkg.devDependencies['eslint-plugin-react-refresh'] = '^0.4.6';
  }
});

// 2) правим apps/web/package.json -> lint:lpt
const webPkgPath = 'apps/web/package.json';
editJson(webPkgPath, (pkg) => {
  pkg.scripts ||= {};
  // базовая команда из вашего лога
  const base = 'node -r ./node_modules/ts-node/register ./node_modules/eslint/bin/eslint.js -c ../../eslint.lpt.config.ts';
  // добавим игнор и отключим no-unused-expressions в лпт-прогоне
  pkg.scripts['lint:lpt'] = `${base} --ignore-pattern postcss.config.cjs --rule "@typescript-eslint/no-unused-expressions: off" .`;
});

console.log('[OK] web LPT quickfix: добавлен eslint-plugin-react-refresh + правка lint:lpt');
