// Очистка устаревших записей файлов без задач.
// Основные модули: dotenv, mongoose, scripts/db/mongoUrl, services/dataStorage, process.
import * as path from 'path';
import type { ConnectOptions } from 'mongoose';

interface DotenvModule {
  config: (options?: { path?: string }) => void;
}

const dotenv: DotenvModule = (() => {
  try {
    return require('dotenv');
  } catch {
    return require(path.resolve(process.cwd(), 'apps/api/node_modules/dotenv'));
  }
})();

const mongoose: typeof import('mongoose') = (() => {
  try {
    return require('mongoose');
  } catch {
    return require(path.resolve(process.cwd(), 'apps/api/node_modules/mongoose'));
  }
})();

const {
  getMongoUrlFromEnv,
  formatCredentialSources,
}: typeof import('../db/mongoUrl') = require('../db/mongoUrl');

const { removeDetachedFilesOlderThan } = require(
  path.resolve(process.cwd(), 'apps/api/src/services/dataStorage'),
) as typeof import('../../apps/api/src/services/dataStorage');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const ttlMinutesRaw = process.env.FILE_CLEANUP_TTL_MINUTES || '1440';
const ttlMinutes = Number(ttlMinutesRaw);

if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0) {
  console.log('FILE_CLEANUP_TTL_MINUTES не задан или не положительный, очистка пропущена');
  process.exit(0);
}

const mongoResolution = getMongoUrlFromEnv();
const mongoUrl = mongoResolution.url;
const credentialsNote = formatCredentialSources(mongoResolution);
if (credentialsNote) {
  console.log(credentialsNote);
}

if (!/^mongodb(\+srv)?:\/\//.test(mongoUrl)) {
  console.warn('MONGO_DATABASE_URL не задан, очистка пропущена');
  process.exit(0);
}

async function connectMongo(): Promise<void> {
  const timeout = 5000;
  const connectOptions: ConnectOptions & { serverSelectionTimeoutMS?: number } = {
    serverSelectionTimeoutMS: timeout,
  };
  await mongoose.connect(mongoUrl, connectOptions);
}

async function cleanup(): Promise<void> {
  await connectMongo();
  const cutoff = new Date(Date.now() - ttlMinutes * 60 * 1000);
  try {
    const removed = await removeDetachedFilesOlderThan(cutoff);
    console.log(
      `Удалено ${removed} устаревших файлов старше ${ttlMinutes} минут без привязки к задачам`,
    );
  } finally {
    await mongoose.disconnect().catch(() => undefined);
  }
}

if (require.main === module) {
  cleanup()
    .catch((error: unknown) => {
      const err = error as { message?: string };
      console.error('Ошибка очистки файлов:', err?.message || error);
      process.exitCode = 1;
    })
    .finally(() => process.exit());
}

export default cleanup;
