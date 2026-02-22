// Назначение: панель проверки состояния сервисов стека
// Основные модули: React, services/healthcheck, ui/button
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowPathIcon,
  PauseIcon,
  PlayIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/button';
import SettingsSectionHeader from './SettingsSectionHeader';
import {
  fetchQueueDiagnostics,
  runFullCycleCheck,
  runQueueRecoveryApply,
  runQueueRecoveryDryRun,
  runStackHealthCheck,
  type FullCycleLogEntry,
  type StackCheckResult,
  type StackCheckStatus,
} from '../../services/healthcheck';

const statusColors: Record<StackCheckStatus, string> = {
  ok: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-700',
  warn: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-700',
  error:
    'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:ring-rose-700',
};

const statusLabels: Record<StackCheckStatus, string> = {
  ok: 'OK',
  warn: 'Предупреждение',
  error: 'Ошибка',
};

const SHORT_INTERVAL_MS = 60_000;

const formatDateTime = (value: string | null): string => {
  if (!value) return 'ещё не запускалось';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('ru-RU');
};

const extractHint = (meta?: Record<string, unknown>): string | null => {
  if (!meta) return null;
  const hint = meta.hint;
  return typeof hint === 'string' ? hint : null;
};

const getQueueCounters = (
  meta?: Record<string, unknown>,
): Record<string, number> | null => {
  if (!meta || typeof meta.queues !== 'object' || !meta.queues) {
    return null;
  }

  const source = meta.queues as Record<string, unknown>;
  const counters: Record<string, number> = {};
  for (const [queueName, value] of Object.entries(source)) {
    if (!value || typeof value !== 'object') continue;
    const metrics = value as Record<string, unknown>;
    const failed =
      typeof metrics.failed === 'number' && Number.isFinite(metrics.failed)
        ? metrics.failed
        : 0;
    const waiting =
      typeof metrics.waiting === 'number' && Number.isFinite(metrics.waiting)
        ? metrics.waiting
        : 0;
    counters[queueName] = failed + waiting;
  }
  return counters;
};

export default function HealthCheckTab(): JSX.Element {
  const [results, setResults] = useState<StackCheckResult[]>([]);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [queueActionLoading, setQueueActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queueActionResult, setQueueActionResult] = useState<string | null>(
    null,
  );
  const [fullCycleLoading, setFullCycleLoading] = useState(false);
  const [fullCycleLogs, setFullCycleLogs] = useState<FullCycleLogEntry[]>([]);
  const [fullCycleSummary, setFullCycleSummary] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const sortedResults = useMemo(
    () => [...results].sort((a, b) => a.name.localeCompare(b.name, 'ru-RU')),
    [results],
  );

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const report = await runStackHealthCheck();
      setResults(report.results);
      setLastRun(report.timestamp);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueueDiagnostics = useCallback(async () => {
    setQueueActionLoading(true);
    setError(null);
    setQueueActionResult(null);
    try {
      const diagnostics = await fetchQueueDiagnostics(20);
      setQueueActionResult(
        `Диагностика: failed geocoding=${diagnostics.geocodingFailed.length}, failed routing=${diagnostics.routingFailed.length}, dead-letter waiting=${diagnostics.deadLetterWaiting.length}.`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(message);
    } finally {
      setQueueActionLoading(false);
    }
  }, []);

  const handleQueueRecoverDryRun = useCallback(async () => {
    setQueueActionLoading(true);
    setError(null);
    setQueueActionResult(null);
    try {
      const result = await runQueueRecoveryDryRun();
      setQueueActionResult(
        `Dry-run: scanned DLQ=${result.deadLetterScanned}, replay=${result.deadLetterReplayed}, skipped=${result.deadLetterSkipped}, errors=${result.errors.length}.`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(message);
    } finally {
      setQueueActionLoading(false);
    }
  }, []);

  const handleQueueRecover = useCallback(async () => {
    setQueueActionLoading(true);
    setError(null);
    setQueueActionResult(null);
    try {
      const result = await runQueueRecoveryApply();
      setQueueActionResult(
        `Восстановление выполнено: retry geocoding=${result.geocodingRetried}/${result.geocodingFailedScanned}, retry routing=${result.routingRetried}/${result.routingFailedScanned}, replay DLQ=${result.deadLetterReplayed}/${result.deadLetterScanned}, удалено DLQ=${result.deadLetterRemoved}, ошибок=${result.errors.length}.`,
      );
      await runCheck();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(message);
    } finally {
      setQueueActionLoading(false);
    }
  }, [runCheck]);

  const handleFullCycleCheck = useCallback(async () => {
    setFullCycleLoading(true);
    setError(null);
    setFullCycleSummary(null);
    setFullCycleLogs([]);
    try {
      const report = await runFullCycleCheck({ strictTelegram: true });
      setFullCycleLogs(report.logs);
      setFullCycleSummary(
        `Full-cycle OK: шагов=${report.logs.length}, файлов=${report.fileIds.length}, период ${formatDateTime(report.startedAt)} → ${formatDateTime(report.finishedAt)}.`,
      );
      await runCheck();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(message);
    } finally {
      setFullCycleLoading(false);
    }
  }, [runCheck]);

  useEffect(() => {
    if (auto) {
      void runCheck();
      timerRef.current = window.setInterval(() => {
        void runCheck();
      }, SHORT_INTERVAL_MS);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [auto, runCheck]);

  return (
    <div className="flex flex-col gap-4">
      <SettingsSectionHeader
        title="Мониторинг"
        description="Проверка S3, storage API, Redis, MongoDB и внешних сервисов"
        icon={ShieldCheckIcon}
        controls={
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="success"
                size="sm"
                className="gap-2"
                disabled={loading}
                onClick={() => void runCheck()}
              >
                {loading ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayIcon className="h-4 w-4" />
                )}
                Запустить проверку
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                disabled={fullCycleLoading}
                onClick={() => void handleFullCycleCheck()}
              >
                {fullCycleLoading ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheckIcon className="h-4 w-4" />
                )}
                Full-cycle задачи
              </Button>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600"
                  checked={auto}
                  onChange={(event) => setAuto(event.target.checked)}
                />
                <span className="flex items-center gap-1">
                  {auto ? (
                    <PauseIcon className="h-4 w-4" />
                  ) : (
                    <PlayIcon className="h-4 w-4" />
                  )}
                  Автоопрос раз в 60 секунд
                </span>
              </label>
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              Последний запуск: {formatDateTime(lastRun)}
            </span>
            <a
              href="/metrics"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-300"
            >
              Открыть Prometheus-метрики (/metrics)
            </a>
          </div>
        }
      />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-900/40 dark:text-rose-100">
          {error}
        </div>
      ) : null}

      {queueActionResult ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100">
          {queueActionResult}
        </div>
      ) : null}

      {fullCycleSummary ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-100">
          {fullCycleSummary}
        </div>
      ) : null}

      {fullCycleLogs.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Full-cycle лог (развёрнутый)
          </h3>
          <div className="max-h-80 space-y-2 overflow-auto">
            {fullCycleLogs.map((entry, index) => (
              <div
                key={`${entry.ts}-${index}`}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold uppercase text-slate-700 dark:text-slate-200">
                    {entry.stage}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 font-semibold ${
                      entry.level === 'error'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-100'
                        : entry.level === 'warn'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-100'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-100'
                    }`}
                  >
                    {entry.level}
                  </span>
                </div>
                <p className="mt-1 text-slate-700 dark:text-slate-200">
                  {entry.message}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {formatDateTime(entry.ts)}
                </p>
                {entry.details ? (
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-slate-900/95 p-2 text-[11px] text-slate-100">
                    {JSON.stringify(entry.details, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid grid-cols-[minmax(120px,170px)_minmax(78px,92px)_64px_minmax(320px,1fr)] items-center gap-3 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <span>Компонент</span>
          <span>Статус</span>
          <span>Время</span>
          <span>Детали</span>
        </div>
        {sortedResults.length === 0 ? (
          <div className="px-4 py-5 text-sm text-slate-600 dark:text-slate-300">
            Результатов пока нет
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {sortedResults.map((item) => (
              <li
                key={item.name}
                className="grid grid-cols-[minmax(120px,170px)_minmax(78px,92px)_64px_minmax(320px,1fr)] items-start gap-3 px-4 py-3 text-sm text-slate-800 dark:text-slate-100"
              >
                <div
                  className="truncate font-semibold capitalize"
                  title={item.name}
                >
                  {item.name}
                </div>
                <div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${statusColors[item.status]}`}
                  >
                    {statusLabels[item.status]}
                  </span>
                </div>
                <div className="text-xs tabular-nums text-slate-500 dark:text-slate-300">
                  {typeof item.durationMs === 'number'
                    ? `${item.durationMs} мс`
                    : '—'}
                </div>
                <div className="space-y-2 text-xs text-slate-700 dark:text-slate-200">
                  {item.message ? (
                    <div className="font-medium text-rose-600 dark:text-rose-200">
                      {item.message}
                    </div>
                  ) : null}
                  {item.name === 'bullmq' && getQueueCounters(item.meta) ? (
                    <div className="grid grid-cols-1 gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                      {Object.entries(getQueueCounters(item.meta) ?? {}).map(
                        ([queue, value]) => (
                          <div
                            key={queue}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="truncate font-medium text-slate-600 dark:text-slate-300">
                              {queue}
                            </span>
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                              {value}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  ) : null}
                  {extractHint(item.meta) ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 font-medium text-amber-800 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-100">
                      Что делать: {extractHint(item.meta)}
                    </div>
                  ) : null}
                  {item.name === 'bullmq' && item.status !== 'ok' ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={queueActionLoading}
                        onClick={() => void handleQueueDiagnostics()}
                      >
                        Проверить очереди
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={queueActionLoading}
                        onClick={() => void handleQueueRecoverDryRun()}
                      >
                        Recover dry-run
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="success"
                        disabled={queueActionLoading}
                        onClick={() => void handleQueueRecover()}
                      >
                        Recover now
                      </Button>
                    </div>
                  ) : null}
                  {item.meta ? (
                    <details className="rounded-xl bg-slate-50 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                      <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        Raw details
                      </summary>
                      <pre className="overflow-x-auto whitespace-pre-wrap border-t border-slate-200 p-3 text-[12px] leading-5 text-slate-800 dark:border-slate-700 dark:text-slate-100">
                        {JSON.stringify(item.meta, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
