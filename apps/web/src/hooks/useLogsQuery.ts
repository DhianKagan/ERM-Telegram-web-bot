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
    const params = new URLSearchParams();
    if (filters.level) params.set('level', filters.level);
    if (filters.message) params.set('message', filters.message);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    params.set('page', String(page));
    params.set('limit', '50');
    authFetch(`/api/v1/logs?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { message: string; level: string }[]) => {
        const parsed = data.map((l) =>
          parseAnsiLogEntry(`${l.level} [${l.createdAt}] ${l.message}`),
        );
        setLogs(parsed);
      });
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
