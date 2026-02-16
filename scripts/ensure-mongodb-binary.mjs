#!/usr/bin/env node

import dns from 'node:dns';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dns.setDefaultResultOrder('ipv4first');

const NETWORK_ERROR_CODES = new Set(['ENETUNREACH', 'ERR_INVALID_IP_ADDRESS']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const requireFromApi = createRequire(path.join(__dirname, '../apps/api/package.json'));

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
