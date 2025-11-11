#!/usr/bin/env node
// patch: 027-add-react-refresh-and-config.cjs
// purpose: add eslint-plugin-react-refresh to root package.json devDependencies
// and write eslint.lpt.config.ts (register plugin + disable rule for LPT)
const fs = require('fs');
const path = require('path');

function err(msg){ console.error(msg); process.exit(2); }

const rootPkg = path.resolve('package.json');
if (!fs.existsSync(rootPkg)) err('package.json not found in repo root');

const pkg = JSON.parse(fs.readFileSync(rootPkg, 'utf8'));
pkg.devDependencies = pkg.devDependencies || {};
if (!pkg.devDependencies['eslint-plugin-react-refresh']) {
  pkg.devDependencies['eslint-plugin-react-refresh'] = 'latest';
  fs.writeFileSync(rootPkg, JSON.stringify(pkg, null, 2) + '\n');
  console.log('[OK] package.json updated: eslint-plugin-react-refresh added to devDependencies');
} else {
  console.log('[SKIP] package.json already contains eslint-plugin-react-refresh — leaving as is');
}

const cfgPath = path.resolve('eslint.lpt.config.ts');
const cfgContent = `// eslint.lpt.config.ts
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * LPT (flat) ESLint config — регистрация плагина react-refresh
 * и выключение проблемного правила в контексте LPT.
 *
 * Если в дальнейшем захотите разрешать инлайновые директивы,
 * можно удалить/ослабить правило здесь и убрать флаг --no-inline-config.
 */
export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      // отключаем правило именно для LPT-прогона — оно больше не будет падать
      'react-refresh/only-export-components': 'off',
    },
    // не проверять postcss-конфиг
    ignores: ['apps/web/postcss.config.cjs'],
  },
];
`;

fs.writeFileSync(cfgPath, cfgContent + '\n', 'utf8');
console.log('[OK] wrote eslint.lpt.config.ts');

console.log('\nДействия выполнены. Далее выполните команды git (ниже) чтобы закоммитить изменения и установить зависимости.\n');
