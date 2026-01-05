// Назначение файла: загрузка и фильтрация логов
// Модули: React, authFetch, parseAnsiLogEntry
import { useEffect, useState } from 'react';
import authFetch from '../utils/authFetch';
import parseAnsiLogEntry, { ParsedLog } from '../utils/parseAnsiLogEntry';

export interface LogFilters {
  level?: string;
  message?: string;
  from?: string;
  to?: string;
  method?: string;
  status?: number;
  endpoint?: string;
  noCsrf?: boolean;
}

export default function useLogsQuery(filters: LogFilters, page: number) {
  const [logs, setLogs] = useState<ParsedLog[]>([]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (filters.level) params.set('level', filters.level);
    if (filters.message) params.set('message', filters.message);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    params.set('page', String(page));
    params.set('limit', '50');

    authFetch(`/api/v1/logs?${params.toString()}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((payload: unknown) => {
        if (cancelled) return;
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as { items?: unknown[] })?.items)
            ? (payload as { items: unknown[] }).items
            : [];
        const parsed = list.map((entry, index) => {
          const record = entry as Record<string, unknown>;
          const level =
            typeof record.level === 'string' ? record.level : 'info';
          const createdAt =
            typeof record.createdAt === 'string'
              ? record.createdAt
              : typeof record.time === 'string'
                ? record.time
                : '';
          const message =
            typeof record.message === 'string'
              ? record.message
              : JSON.stringify(record);
          const parsedEntry = parseAnsiLogEntry(
            `${level} [${createdAt}] ${message}`,
          );
          return {
            ...parsedEntry,
            level: parsedEntry.level || level,
            time: parsedEntry.time || createdAt || undefined,
            // запасной ключ, чтобы избежать конфликтов при одинаковых строках
            id: `${createdAt || 'log'}-${index}`,
          };
        });
        setLogs(parsed);
      })
      .catch(() => {
        if (cancelled) return;
        setLogs([]);
      });

    return () => {
      cancelled = true;
    };
  }, [filters, page]);

  return logs.filter((l) => {
    if (filters.method && l.method !== filters.method) return false;
    if (filters.status && l.status !== filters.status) return false;
    if (filters.endpoint && !(l.endpoint || '').includes(filters.endpoint))
      return false;
    if (filters.noCsrf && l.csrf !== false) return false;
    return true;
  });
}
