#!/usr/bin/env node
// Назначение файла: проверяет наличие локальных шрифтов и скачивает недостающие.
// Основные модули: fs/promises, path, url, fetch
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fontsDir = path.join(__dirname, '../apps/web/public/fonts');

const fonts = [
  {
    file: 'inter-400.ttf',
    url: 'https://fonts.gstatic.com/s/inter/v19/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf',
  },
  {
    file: 'inter-700.ttf',
    url: 'https://fonts.gstatic.com/s/inter/v19/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf',
  },
  {
    file: 'poppins-400.ttf',
    url: 'https://fonts.gstatic.com/s/poppins/v23/pxiEyp8kv8JHgFVrFJA.ttf',
  },
  {
    file: 'poppins-700.ttf',
    url: 'https://fonts.gstatic.com/s/poppins/v23/pxiByp8kv8JHgFVrLCz7V1s.ttf',
  },
  {
    file: 'roboto-400.ttf',
    url: 'https://fonts.gstatic.com/s/roboto/v48/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmT.ttf',
  },
  {
    file: 'roboto-700.ttf',
    url: 'https://fonts.gstatic.com/s/roboto/v48/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjammT.ttf',
  },
];

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadFont({ file, url }) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Не удалось скачать ${file}: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(path.join(fontsDir, file), buffer);
}

async function ensureFonts() {
  await mkdir(fontsDir, { recursive: true });
  let downloaded = 0;
  for (const font of fonts) {
    const target = path.join(fontsDir, font.file);
    if (await fileExists(target)) {
      continue;
    }
    await downloadFont(font);
    downloaded += 1;
  }
  if (downloaded > 0) {
    console.log(`Скачано шрифтов: ${downloaded}`);
  }
}

ensureFonts().catch((error) => {
  console.error('Ошибка загрузки шрифтов:', error);
  process.exitCode = 1;
});
