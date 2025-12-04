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
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/button';
import {
  runStackHealthCheck,
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

export default function HealthCheckTab(): JSX.Element {
  const [results, setResults] = useState<StackCheckResult[]>([]);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      <div className="flex flex-wrap items-center gap-3">
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
        <span className="text-sm text-slate-600 dark:text-slate-300">
          Последний запуск: {formatDateTime(lastRun)}
        </span>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-900/40 dark:text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid grid-cols-[1fr_auto_auto_2fr] items-center gap-2 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
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
                className="grid grid-cols-[1fr_auto_auto_2fr] items-start gap-2 px-4 py-3 text-sm text-slate-800 dark:text-slate-100"
              >
                <div className="font-semibold capitalize">{item.name}</div>
                <div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${statusColors[item.status]}`}
                  >
                    {statusLabels[item.status]}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-300">
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
                  {extractHint(item.meta) ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 font-medium text-amber-800 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-100">
                      Что делать: {extractHint(item.meta)}
                    </div>
                  ) : null}
                  {item.meta ? (
                    <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-[13px] leading-5 text-slate-800 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700">
                      {JSON.stringify(item.meta, null, 2)}
                    </pre>
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
