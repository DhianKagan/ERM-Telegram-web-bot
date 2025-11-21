#!/usr/bin/env node
// patch: 044-maplibre-proxy.cjs
// purpose: перенаправить utils/mapLibrary на общий модуль с безопасной регистрацией PMTiles

const fs = require('fs');
const path = require('path');

const target = path.resolve('apps/web/src/utils/mapLibrary.ts');

const nextSource = `// Назначение: прокси к единой библиотеке карты с поддержкой PMTiles
// Основные модули: maplibre-gl, pmtiles

export * from '../mapLibrary';
export { default } from '../mapLibrary';
`;

fs.writeFileSync(target, nextSource, 'utf8');
console.log('rewrote ' + path.relative(process.cwd(), target));
