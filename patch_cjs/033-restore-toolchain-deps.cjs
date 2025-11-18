#!/usr/bin/env node
// patch: 033-restore-toolchain-deps.cjs
// purpose: вернуть дев-зависимости тулчейна в пакетах API и Web, чтобы pnpm exec находил бинарники
const fs = require('fs');
const path = require('path');

const ensureDeps = (pkgPath, deps) => {
  const absolute = path.resolve(pkgPath);
  const json = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  json.devDependencies ||= {};
  let touched = false;
  Object.entries(deps).forEach(([name, version]) => {
    if (json.devDependencies[name] !== version) {
      json.devDependencies[name] = version;
      touched = true;
    }
  });
  if (!touched) {
    console.log(`no changes for ${pkgPath}`);
    return;
  }
  const ordered = Object.keys(json.devDependencies)
    .sort()
    .reduce((acc, key) => {
      acc[key] = json.devDependencies[key];
      return acc;
    }, {});
  json.devDependencies = ordered;
  fs.writeFileSync(absolute, JSON.stringify(json, null, 2) + '\n');
  console.log(`updated ${pkgPath}`);
};

ensureDeps('apps/api/package.json', {
  'cross-env': '^10.1.0',
  eslint: '9.39.1',
  jest: '^29.7.0',
  'lint-staged': '^16.1.2',
  prettier: '3.6.2',
  'ts-node': '^10.9.2',
  typescript: '5.9.3'
});

ensureDeps('apps/web/package.json', {
  'cross-env': '^10.1.0',
  eslint: '9.39.1',
  prettier: '3.6.2',
  typescript: '5.9.3'
});
