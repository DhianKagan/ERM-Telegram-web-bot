#!/usr/bin/env node
// patch: 038-railway-cors-allowlist.cjs
// purpose: удалить сторонний origin из CORS_ORIGINS в Railway/.env
const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('Railway/.env');
const content = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');
const needle = 'CORS_ORIGINS=https://agromarket.up.railway.app,https://api.protomaps.com';
const desired = 'CORS_ORIGINS=https://agromarket.up.railway.app';

if (!content.includes(needle) && !content.includes(desired)) {
  console.error('expected CORS_ORIGINS entry not found');
  process.exit(1);
}

if (content.includes(needle)) {
  const updated = content.replace(needle, desired);
  fs.writeFileSync(targetPath, updated, 'utf8');
  console.log(`updated ${path.relative(process.cwd(), targetPath)}`);
} else {
  console.log('no update needed; desired allowlist already applied');
}
