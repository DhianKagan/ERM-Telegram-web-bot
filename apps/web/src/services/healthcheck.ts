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

export type QueueRecoveryDiagnosticsResponse = {
  enabled: boolean;
  generatedAt: string;
  geocodingFailed: unknown[];
  routingFailed: unknown[];
  deadLetterWaiting: unknown[];
  deadLetterFailed: unknown[];
};

export type QueueRecoveryRunResponse = {
  enabled: boolean;
  dryRun: boolean;
  geocodingFailedScanned: number;
  geocodingRetried: number;
  routingFailedScanned: number;
  routingRetried: number;
  deadLetterScanned: number;
  deadLetterReplayed: number;
  deadLetterRemoved: number;
  deadLetterSkipped: number;
  deadLetterSkippedRemoved: number;
  errors: string[];
};

export type FullCycleLogEntry = {
  ts: string;
  stage:
    | 'setup'
    | 'prepare_fixtures'
    | 'create_task'
    | 'telegram_check'
    | 'delete_task'
    | 'verify_task_deleted'
    | 'verify_files_cleanup'
    | 'finish';
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
};

export type FullCycleCheckResponse = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  taskId?: string;
  fileIds: string[];
  logs: FullCycleLogEntry[];
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

export async function fetchQueueDiagnostics(
  limit = 20,
): Promise<QueueRecoveryDiagnosticsResponse> {
  const response = await authFetch(
    `/api/v1/system/queues/diagnostics?limit=${Math.max(1, Math.trunc(limit))}`,
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Диагностика очередей недоступна: ${response.status} ${text}`,
    );
  }

  return (await response.json()) as QueueRecoveryDiagnosticsResponse;
}

export async function runQueueRecoveryDryRun(): Promise<QueueRecoveryRunResponse> {
  const response = await authFetch('/api/v1/system/queues/recover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dryRun: true }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Dry-run восстановления недоступен: ${response.status} ${text}`,
    );
  }

  return (await response.json()) as QueueRecoveryRunResponse;
}

export async function runQueueRecoveryApply(): Promise<QueueRecoveryRunResponse> {
  const response = await authFetch('/api/v1/system/queues/recover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dryRun: false,
      confirmReplayRemove: true,
      removeReplayedDeadLetter: true,
      removeSkippedDeadLetter: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Восстановление очередей недоступно: ${response.status} ${text}`,
    );
  }

  return (await response.json()) as QueueRecoveryRunResponse;
}

export async function runFullCycleCheck(options?: {
  timeoutMs?: number;
  pollMs?: number;
  strictTelegram?: boolean;
}): Promise<FullCycleCheckResponse> {
  const response = await authFetch('/api/v1/system/full-cycle-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options ?? {}),
  });

  const payload = (await response.json()) as FullCycleCheckResponse;
  if (!response.ok) {
    const lastError = payload.logs
      .slice()
      .reverse()
      .find((entry) => entry.level === 'error');
    throw new Error(
      lastError?.message ?? 'Full-cycle проверка завершилась ошибкой',
    );
  }

  return payload;
}
