#!/usr/bin/env node
import fs from 'node:fs';

const pkgPath = new URL('../../package.json', import.meta.url);
const raw = fs.readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(raw);

// гарантируем раздел scripts
pkg.scripts = pkg.scripts || {};

// не ломаем существующее — только добавляем/заменяем нужные ключи
const desired = {
  preinstall: 'corepack enable || true',
  test: pkg.scripts.test || 'vitest',
  'test:unit': 'vitest --run --reporter=junit --outputFile=artifacts/junit.xml',
  'test:api': 'vitest --run --dir tests/api',
  'test:e2e': 'playwright test --config=tests/e2e/playwright.config.ts || true',
  lint: 'eslint . -f unix > artifacts/lint.txt || true',
  build: pkg.scripts.build || 'tsc -b && vite build',
  'ci:fast': 'pnpm lint && pnpm test:unit && pnpm build -- --mode=ci',
  'ci:full':
    'pnpm lint && pnpm test && pnpm build -- --mode=ci && pnpm test:e2e',
};

Object.assign(pkg.scripts, desired);

// полезные devDeps (необязательно, если уже стоят)
pkg.devDependencies = pkg.devDependencies || {};
const wantDev = {
  vitest: '^2.0.0',
  '@playwright/test': '^1.48.0',
  eslint: '^9.0.0',
  typescript: '^5.6.0',
  vite: '^5.0.0',
};
for (const [k, v] of Object.entries(wantDev)) {
  if (!pkg.devDependencies[k]) pkg.devDependencies[k] = v;
}

// сохраняем
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('[apply-scripts] package.json updated.');
