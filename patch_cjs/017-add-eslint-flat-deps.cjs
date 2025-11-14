#!/usr/bin/env node
// patch: 017-add-eslint-flat-deps.cjs
// purpose: добавить минимальный набор deps для flat-конфига ESLint v9
const fs = require('fs');
const path = 'package.json';
const pkg = JSON.parse(fs.readFileSync(path,'utf8'));
pkg.devDependencies ||= {};
// уже добавляли @eslint/js
pkg.devDependencies['globals'] ||= '^13.24.0';
pkg.devDependencies['typescript-eslint'] ||= '^8.0.0';
fs.writeFileSync(path, JSON.stringify(pkg,null,2));
console.log('[OK] devDeps для ESLint flat config добавлены: globals, typescript-eslint');
