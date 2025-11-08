// Назначение: проверка персистентности троттла метода close между загрузками модуля.
// Основные модули: jest, fs/promises, path, os, closeThrottleStore.
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const TMP_PREFIX = 'close-throttle-store-test-';

const createIsolatedStore = async <T>(
  callback: () => Promise<T>,
): Promise<T> => {
  jest.resetModules();
  return callback();
};

test('значение троттла читается после повторной загрузки модуля', async () => {
  const baseDir = os.tmpdir();
  const customDir = await mkdtemp(path.join(baseDir, TMP_PREFIX));
  const tmpdirSpy = jest.spyOn(os, 'tmpdir').mockReturnValue(customDir);
  const storedValue = Date.now() + 60_000;

  await createIsolatedStore(async () => {
    const store = await import('../src/bot/closeThrottleStore');
    await store.resetCloseThrottle();
    expect(store.getCloseThrottleUntil()).toBe(0);
    await store.updateCloseThrottleUntil(storedValue);
  });

  await createIsolatedStore(async () => {
    const store = await import('../src/bot/closeThrottleStore');
    expect(store.getCloseThrottleUntil()).toBe(storedValue);
    await store.resetCloseThrottle();
  });

  tmpdirSpy.mockRestore();
  await rm(customDir, { recursive: true, force: true });
});
