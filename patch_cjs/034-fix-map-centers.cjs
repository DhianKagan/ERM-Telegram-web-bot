#!/usr/bin/env node
// patch: 034-fix-map-centers.cjs
// purpose: исправить порядок широты/долготы в LogisticsPage и TaskDialog
const fs = require('fs');
const path = require('path');

const patches = [
  {
    file: path.resolve('apps/web/src/pages/Logistics.tsx'),
    from: `const MAP_CENTER_LNG_LAT: [number, number] = [
  MAP_DEFAULT_CENTER[1],
  MAP_DEFAULT_CENTER[0],
];`,
    to: `const MAP_CENTER_LNG_LAT: [number, number] = [
  MAP_DEFAULT_CENTER[0],
  MAP_DEFAULT_CENTER[1],
];`,
  },
  {
    file: path.resolve('apps/web/src/components/TaskDialog.tsx'),
    from: `      : [MAP_DEFAULT_CENTER[1], MAP_DEFAULT_CENTER[0]];`,
    to: `      : [MAP_DEFAULT_CENTER[0], MAP_DEFAULT_CENTER[1]];`,
  },
];

for (const patch of patches) {
  const source = fs.readFileSync(patch.file, 'utf8');
  if (!source.includes(patch.from)) {
    throw new Error(`snippet not found in ${patch.file}`);
  }
  const updated = source.replace(patch.from, patch.to);
  fs.writeFileSync(patch.file, updated, 'utf8');
  console.log('updated ' + path.relative(process.cwd(), patch.file));
}
