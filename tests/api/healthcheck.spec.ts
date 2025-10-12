/**
 * Назначение файла: тестирование статуса здоровья API.
 * Основные модули: mongoose, mongodb-memory-server, collectHealthStatus.
 */
import { strict as assert } from 'assert';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { collectHealthStatus } from '../../apps/api/src/api/healthcheck';

declare const describe: (
  name: string,
  suite: (this: unknown) => void,
) => void;
declare const it: (
  name: string,
  test: (this: unknown) => unknown | Promise<unknown>,
) => void;
declare const before: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;
declare const after: (
  handler: (this: unknown) => unknown | Promise<unknown>,
) => void;

describe('collectHealthStatus', function () {
  const suite = this as { timeout?: (ms: number) => void };
  suite.timeout?.(60000);
  let mongod: MongoMemoryServer;

  before(async function () {
    const hook = this as { timeout?: (ms: number) => void };
    hook.timeout?.(60000);
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  });

  it('возвращает ok при доступной MongoDB', async () => {
    const status = await collectHealthStatus();
    assert.equal(status.status, 'ok');
    assert.equal(status.checks.mongo.status, 'up');
    assert.ok(status.timestamp);
    if (status.checks.mongo.latencyMs !== undefined) {
      assert.equal(typeof status.checks.mongo.latencyMs, 'number');
    }
  });

  it('возвращает error при недоступной MongoDB', async () => {
    await mongoose.disconnect();
    const status = await collectHealthStatus();
    assert.equal(status.status, 'error');
    assert.equal(status.checks.mongo.status, 'down');
    assert.ok(status.checks.mongo.message);
    await mongoose.connect(mongod.getUri());
  });
});
