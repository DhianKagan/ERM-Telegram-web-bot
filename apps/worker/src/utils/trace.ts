// apps/worker/src/utils/trace.ts
// Минимальная заглушка трассировки для воркера.

export type TraceStore = {
  traceId?: string;
  traceparent?: string;
};

export function getTrace(): TraceStore | undefined {
  return undefined;
}
