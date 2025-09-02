// Назначение файла: генерация геро-изображений в форматах WebP и AVIF.
// Основные модули: sharp, fs, path.

import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const dir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(dir, '..', 'apps', 'web', 'public');
const src = join(publicDir, 'vite.svg');

async function generate() {
  const svg = await fs.readFile(src);
  await sharp(svg).toFormat('webp').toFile(join(publicDir, 'vite.webp'));
  await sharp(svg).toFormat('avif').toFile(join(publicDir, 'vite.avif'));
}

generate().catch((err) => {
  console.error('Не удалось создать геро-изображения', err);
  process.exit(1);
});
