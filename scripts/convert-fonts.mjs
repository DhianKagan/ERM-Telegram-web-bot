#!/usr/bin/env node
// Назначение файла: конвертирует локальные TTF-шрифты в формат WOFF2.
// Основные модули: fs/promises, path, url, ttf2woff2.
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ttf2woff2 from 'ttf2woff2';

export async function convertFonts(fontsDir) {
  const entries = await readdir(fontsDir, { withFileTypes: true });
  const ttfFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.ttf'));

  let convertedCount = 0;
  for (const entry of ttfFiles) {
    const ttfPath = path.join(fontsDir, entry.name);
    const woff2Path = ttfPath.replace(/\.ttf$/, '.woff2');

    let needsConversion = false;
    try {
      const [ttfStat, woff2Stat] = await Promise.all([stat(ttfPath), stat(woff2Path)]);
      if (ttfStat.mtimeMs > woff2Stat.mtimeMs || woff2Stat.size === 0) {
        needsConversion = true;
      }
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        /** @type {{ code?: unknown }} */ (error).code === 'ENOENT'
      ) {
        needsConversion = true;
      } else {
        throw error;
      }
    }

    if (!needsConversion) {
      continue;
    }

    const ttfBuffer = await readFile(ttfPath);
    const woff2Buffer = Buffer.from(ttf2woff2(ttfBuffer));
    await writeFile(woff2Path, woff2Buffer);
    convertedCount += 1;
  }

  if (convertedCount > 0) {
    console.log(`Сконвертировано шрифтов WOFF2: ${convertedCount}`);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;

if (invokedPath === __filename) {
  const fontsDir = path.join(__dirname, '../apps/web/public/fonts');

  convertFonts(fontsDir).catch((error) => {
    console.error('Ошибка конвертации шрифтов в WOFF2:', error);
    process.exitCode = 1;
  });
}
