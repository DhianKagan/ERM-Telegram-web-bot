#!/usr/bin/env node

import dns from 'node:dns';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dns.setDefaultResultOrder('ipv4first');

const NETWORK_ERROR_CODES = new Set(['ENETUNREACH', 'ERR_INVALID_IP_ADDRESS']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const requireFromApi = createRequire(path.join(__dirname, '../apps/api/package.json'));

const tryLoadMongoUrlFromEnvFiles = () => {
  if (process.env.MONGO_DATABASE_URL) {
    return;
  }

  const candidates = [
    path.resolve(process.cwd(), '.env.test'),
    path.resolve(process.cwd(), '.env'),
    path.join(repoRoot, 'apps/api/.env.test'),
    path.join(repoRoot, 'apps/api/.env'),
  ];

  for (const envPath of candidates) {
    if (!existsSync(envPath)) {
      continue;
    }

    const content = readFileSync(envPath, 'utf8');
    const line = content
      .split(/\r?\n/)
      .find((rawLine) => rawLine.startsWith('MONGO_DATABASE_URL='));

    if (!line) {
      continue;
    }

    const value = line.slice('MONGO_DATABASE_URL='.length).trim();
    if (!value) {
      continue;
    }

    process.env.MONGO_DATABASE_URL = value;
    console.log(`[ensure-mongodb-binary] loaded MONGO_DATABASE_URL from ${path.relative(repoRoot, envPath)}`);
    return;
  }
};

const getErrorCode = (error) => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const typedError = /** @type {{ code?: string; cause?: { code?: string } }} */ (error);
  return typedError.code ?? typedError.cause?.code;
};

const warmupMongoBinary = async () => {
  const { MongoMemoryServer } = requireFromApi('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create();
  await mongod.stop();
};

const run = async () => {
  tryLoadMongoUrlFromEnvFiles();

  if (process.env.MONGO_DATABASE_URL) {
    console.log('[ensure-mongodb-binary] skip warmup: external MONGO_DATABASE_URL is configured');
    return;
  }

  try {
    await warmupMongoBinary();
    console.log('[ensure-mongodb-binary] MongoDB binary is ready');
    return;
  } catch (error) {
    const code = getErrorCode(error);
    if (!NETWORK_ERROR_CODES.has(code)) {
      throw error;
    }

    process.env.MONGOMS_DOWNLOAD_MIRROR ||= 'https://downloads.mongodb.com';
    console.warn(
      `[ensure-mongodb-binary] retry with mirror ${process.env.MONGOMS_DOWNLOAD_MIRROR} after ${code}`,
    );

    try {
      await warmupMongoBinary();
      console.log('[ensure-mongodb-binary] MongoDB binary is ready via mirror');
    } catch (mirrorError) {
      const mirrorCode = getErrorCode(mirrorError);
      if (!NETWORK_ERROR_CODES.has(mirrorCode)) {
        throw mirrorError;
      }
      console.warn('[ensure-mongodb-binary] skip warmup due to network restrictions');
    }
  }
};

run().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error('[ensure-mongodb-binary] failed:', message);
  process.exitCode = 1;
});
