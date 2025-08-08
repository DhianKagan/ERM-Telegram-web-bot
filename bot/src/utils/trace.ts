// Назначение: управление контекстом трассировки
// Основные модули: AsyncLocalStorage
import { AsyncLocalStorage } from 'async_hooks';

interface TraceStore {
  traceId: string;
  traceparent: string;
}

const storage = new AsyncLocalStorage<TraceStore>();

export function runWithTrace<T>(store: TraceStore, fn: () => T): T {
  return storage.run(store, fn);
}

export function getTrace(): TraceStore | undefined {
  return storage.getStore();
}
