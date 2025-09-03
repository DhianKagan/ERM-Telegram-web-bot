// Назначение файла: генерация hero-изображений для Open Graph.
// Основные модули: fs/promises, path, sharp.

import fs from 'fs/promises';
import path from 'path';

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  ({ default: sharp } = await import(
    '../apps/api/node_modules/sharp/lib/index.js'
  ));
}

const outDir = path.resolve('apps/web/public/hero');
await fs.mkdir(outDir, { recursive: true });

const pages = [
  { name: 'index', text: 'ERM Web App' },
  { name: 'routes', text: 'Маршруты' },
];

for (const p of pages) {
  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
    <rect width="1200" height="630" fill="url(#g)"/>
    <text x="50%" y="50%" font-size="64" fill="#fff" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle">${p.text}</text>
  </svg>`;
  const buffer = Buffer.from(svg);
  await sharp(buffer)
    .png()
    .toFile(path.join(outDir, `${p.name}.png`));
}
