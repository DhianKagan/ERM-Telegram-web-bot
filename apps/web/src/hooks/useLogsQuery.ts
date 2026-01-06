// Назначение файла: загрузка и фильтрация логов
// Модули: React, authFetch, parseAnsiLogEntry
import { useMemo } from 'react';
import { useApiQuery } from './useApiQuery';
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

const mapPayloadToLogs = (payload: unknown): ParsedLog[] => {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { items?: unknown[] })?.items)
      ? (payload as { items: unknown[] }).items
      : [];

  return items.map((entry, index) => {
    const record = entry as Record<string, unknown>;
    const level = typeof record.level === 'string' ? record.level : 'info';
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
    const parsedEntry = parseAnsiLogEntry(`${level} [${createdAt}] ${message}`);
    return {
      ...parsedEntry,
      level: parsedEntry.level || level,
      time: parsedEntry.time || createdAt || undefined,
      // запасной ключ, чтобы избежать конфликтов при одинаковых строках
      id: `${createdAt || 'log'}-${index}`,
    } as ParsedLog;
  });
};

export default function useLogsQuery(
  filters: LogFilters,
  page: number,
  options?: { live?: boolean },
) {
  const params = useMemo(() => {
    const search = new URLSearchParams();
    if (filters.level) search.set('level', filters.level);
    if (filters.message) search.set('message', filters.message);
    if (filters.from) search.set('from', filters.from);
    if (filters.to) search.set('to', filters.to);
    search.set('page', String(page));
    search.set('limit', '50');
    return search;
  }, [filters.from, filters.level, filters.message, filters.to, page]);

  const queryKey = useMemo(
    () => ['logs', { ...filters, page }],
    [filters, page],
  );

  return useApiQuery<ParsedLog[]>({
    queryKey,
    url: `/api/v1/logs?${params.toString()}`,
    parse: async (response) => {
      if (!response.ok) return [];
      const payload = (await response.json().catch(() => [])) as unknown;
      return mapPayloadToLogs(payload);
    },
    select: (data) =>
      data.filter((log) => {
        if (filters.method && log.method !== filters.method) return false;
        if (filters.status && log.status !== filters.status) return false;
        if (
          filters.endpoint &&
          !(log.endpoint || '').includes(filters.endpoint)
        ) {
          return false;
        }
        if (filters.noCsrf && log.csrf !== false) return false;
        return true;
      }),
    refetchInterval: options?.live ? 5000 : false,
    keepPreviousData: true,
  });
}
