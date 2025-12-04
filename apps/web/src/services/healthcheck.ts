// Назначение: вызовы админского healthcheck API
// Основные модули: authFetch
import authFetch from '../utils/authFetch';

export type StackCheckStatus = 'ok' | 'warn' | 'error';

export type StackCheckResult = {
  name: string;
  status: StackCheckStatus;
  durationMs?: number;
  message?: string;
  meta?: Record<string, unknown>;
};

export type StackHealthResponse = {
  ok: boolean;
  timestamp: string;
  results: StackCheckResult[];
};

const isStackCheckResult = (value: unknown): value is StackCheckResult => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { name?: unknown; status?: unknown };
  return (
    typeof candidate.name === 'string' &&
    (candidate.status === 'ok' ||
      candidate.status === 'warn' ||
      candidate.status === 'error')
  );
};

export async function runStackHealthCheck(): Promise<StackHealthResponse> {
  const response = await authFetch('/api/v1/system/health/run', {
    method: 'POST',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Healthcheck недоступен: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as unknown;
  if (!payload || typeof payload !== 'object') {
    throw new Error('Неверный ответ healthcheck');
  }

  const { ok, timestamp, results } = payload as Record<string, unknown>;
  if (
    typeof ok !== 'boolean' ||
    typeof timestamp !== 'string' ||
    !Array.isArray(results)
  ) {
    throw new Error('Неполный ответ healthcheck');
  }

  const parsedResults = results.filter(isStackCheckResult);
  return {
    ok,
    timestamp,
    results: parsedResults,
  } satisfies StackHealthResponse;
}
