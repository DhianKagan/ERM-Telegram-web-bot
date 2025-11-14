// Компонент просмотра логов на React Table
// Модули: React, useLogsQuery, FiltersPanel, DataTable (лениво), logColumns
import React, { lazy, Suspense } from 'react';
import useLogsQuery, { LogFilters } from '../hooks/useLogsQuery';
import FiltersPanel from './FiltersPanel';
const DataTable = lazy(() => import('./DataTable'));
import logColumns from '../columns/logColumns';

export default function LogViewer() {
  const [filters, setFilters] = React.useState<LogFilters>({});
  const [live, setLive] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const logs = useLogsQuery(filters, page + 1);

  React.useEffect(() => {
    setPage(0);
  }, [filters]);

  React.useEffect(() => {
    if (!live) return;
    const id = setInterval(
      () => setFilters((current) => ({ ...current })),
      5000,
    );
    return () => clearInterval(id);
  }, [live]);

  return (
    <div className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Логи</h2>
        <label
          className="flex items-center gap-1 text-sm"
          htmlFor="log-live-toggle"
        >
          <input
            id="log-live-toggle"
            name="liveUpdates"
            type="checkbox"
            checked={live}
            onChange={(e) => setLive(e.target.checked)}
          />
          Live
        </label>
      </div>
      <FiltersPanel filters={filters} onChange={setFilters} />
      <Suspense fallback={<div>Загрузка таблицы...</div>}>
        <DataTable
          columns={logColumns}
          data={logs}
          pageIndex={page}
          pageSize={50}
          onPageChange={setPage}
        />
      </Suspense>
    </div>
  );
}
