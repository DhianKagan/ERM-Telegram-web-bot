#!/usr/bin/env node
// Назначение файла: проверяет наличие локальных шрифтов, скачивает недостающие и конвертирует их в WOFF2.
// Основные модули: fs/promises, path, url, fetch, dns, child_process
import { access, mkdir, writeFile } from 'node:fs/promises';
import dns from 'node:dns';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { convertFonts } from './convert-fonts.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fontsDir = path.join(__dirname, '../apps/web/public/fonts');

dns.setDefaultResultOrder('ipv4first');

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

async function downloadViaCurl(url, targetPath) {
  await new Promise((resolve, reject) => {
    execFile('curl', ['-fsSL', '-o', targetPath, url], (error) => {
      if (error) {
        reject(new Error(`Не удалось скачать ${url} через curl: ${error.message}`));
        return;
      }
      resolve();
    });
  });
}

async function downloadFont({ file, url }) {
  const target = path.join(fontsDir, file);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Не удалось скачать ${file}: ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(target, buffer);
    return;
  } catch (error) {
    const causeCode = error?.cause?.code ?? error?.code;
    if (causeCode !== 'ENETUNREACH' && causeCode !== 'ERR_INVALID_IP_ADDRESS') {
      throw error;
    }
  }
  try {
    await downloadViaCurl(url, target);
  } catch (curlError) {
    const message = curlError instanceof Error ? curlError.message : String(curlError);
    throw new Error(`Не удалось скачать ${file}: ${message}`);
  }
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

  await convertFonts(fontsDir);
}

ensureFonts().catch((error) => {
  console.error('Ошибка загрузки шрифтов:', error);
  process.exitCode = 1;
});
