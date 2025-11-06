#!/usr/bin/env node
// Назначение файла: конвертирует локальные TTF-шрифты в формат WOFF2.
// Основные модули: fs/promises, path, url, динамический импорт ttf2woff2.
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedTtf2Woff2 = null;

async function loadTtf2Woff2() {
  if (cachedTtf2Woff2) {
    return cachedTtf2Woff2;
  }

  try {
    const module = await import('ttf2woff2');
    const resolved = module.default ?? module;
    cachedTtf2Woff2 = resolved;
    return resolved;
  } catch (error) {
    console.error('\n\x1b[31mОтсутствует зависимость "ttf2woff2"\x1b[0m');
    console.error('Установите её в пакете web командой:');
    console.error('  pnpm -F web add -D ttf2woff2');
    console.error('\nЕсли сборка идёт в CI, убедитесь, что доступны инструменты сборки:');
    console.error('  apt-get update && apt-get install -y --no-install-recommends build-essential python3');
    if (error instanceof Error && error.message) {
      console.error(`\nПодробности: ${error.message}`);
    }
    process.exit(1);
  }
}

export async function convertFonts(fontsDir) {
  const ttf2woff2 = await loadTtf2Woff2();
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
