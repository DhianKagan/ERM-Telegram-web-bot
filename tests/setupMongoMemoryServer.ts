/**
 * Назначение файла: настройка каталога скачивания mongodb-memory-server для параллельных тестов.
 * Основные модули: fs, os, path.
 */

import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

if (!process.env.MONGOMS_DOWNLOAD_DIR) {
  const baseDir = path.join(os.tmpdir(), 'mongodb-memory-server');
  const cacheDir = path.join(baseDir, 'cache');
  const workerId = process.env.JEST_WORKER_ID ?? '0';
  const workerDir = path.join(baseDir, workerId);

  mkdirSync(cacheDir, { recursive: true });
  mkdirSync(workerDir, { recursive: true });
  process.env.MONGOMS_DOWNLOAD_DIR = cacheDir;
  process.env.MONGOMS_CACHE_DIR ||= cacheDir;
  process.env.MONGOMS_TMP_DIR ||= workerDir;
}

process.env.MONGOMS_DISABLE_MD5_CHECK ||= '1';
process.env.MONGOMS_PREFER_GLOBAL_PATH ||= '0';
