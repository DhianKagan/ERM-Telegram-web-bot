/**
 * Назначение файла: настройка каталога скачивания mongodb-memory-server для параллельных тестов.
 * Основные модули: fs, os, path.
 */

import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

if (!process.env.MONGOMS_DOWNLOAD_DIR) {
  const baseDir = path.join(os.tmpdir(), 'mongodb-memory-server');
  const workerId = process.env.JEST_WORKER_ID ?? '0';
  const downloadDir = path.join(baseDir, workerId);

  mkdirSync(downloadDir, { recursive: true });
  process.env.MONGOMS_DOWNLOAD_DIR = downloadDir;
  process.env.MONGOMS_CACHE_DIR ||= downloadDir;
}

process.env.MONGOMS_DISABLE_MD5_CHECK ||= '1';
process.env.MONGOMS_PREFER_GLOBAL_PATH ||= '0';
