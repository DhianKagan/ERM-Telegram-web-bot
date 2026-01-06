// Компонент просмотра логов на React Table
// Модули: React, useLogsQuery, FiltersPanel, DataTable (лениво), logColumns
import React, { lazy, Suspense } from 'react';

import ActionBar from './ActionBar';
import Breadcrumbs from './Breadcrumbs';
import FiltersPanel from './FiltersPanel';
const DataTable = lazy(() => import('./DataTable'));
import logColumns from '../columns/logColumns';
import useLogsQuery, { LogFilters } from '../hooks/useLogsQuery';
import { Button } from '@/components/ui/button';

export default function LogViewer() {
  const [filters, setFilters] = React.useState<LogFilters>({});
  const [live, setLive] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const logs = useLogsQuery(filters, page + 1);

  const resetFilters = React.useCallback(() => setFilters({}), []);
  const refreshNow = React.useCallback(
    () => setFilters((current) => ({ ...current })),
    [],
  );

  React.useEffect(() => {
    setPage(0);
  }, [filters]);

  React.useEffect(() => {
    if (!live) return;
    const id = setInterval(() => refreshNow(), 5000);
    return () => clearInterval(id);
  }, [live, refreshNow]);

  return (
    <div className="space-y-4">
      <ActionBar
        breadcrumbs={<Breadcrumbs items={[{ label: 'Журнал событий' }]} />}
        title="Журнал событий"
        description="Технические логи приложения в едином формате."
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <label
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-[color:var(--color-gray-200)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--color-gray-700)] shadow-sm transition hover:border-[color:var(--color-gray-300)] dark:border-[color:var(--color-gray-700)] dark:bg-[color:var(--color-gray-dark)] dark:text-[color:var(--color-gray-50)]"
              htmlFor="log-live-toggle"
            >
              <input
                id="log-live-toggle"
                name="liveUpdates"
                type="checkbox"
                className="h-4 w-4"
                checked={live}
                onChange={(event) => setLive(event.target.checked)}
              />
              Автообновление
            </label>
            <Button size="sm" variant="outline" onClick={refreshNow}>
              Обновить
            </Button>
          </div>
        }
      />

      <div className="rounded-3xl border border-[color:var(--color-gray-200)] bg-white p-3 shadow-[var(--shadow-theme-sm)] dark:border-[color:var(--color-gray-700)] dark:bg-[color:var(--color-gray-dark)] sm:p-4">
        <Suspense fallback={<div>Загрузка таблицы...</div>}>
          <DataTable
            columns={logColumns}
            data={logs}
            pageIndex={page}
            pageSize={50}
            onPageChange={setPage}
            showGlobalSearch={false}
            showFilters={false}
            toolbarChildren={
              <div className="flex w-full flex-wrap items-center gap-2">
                <FiltersPanel filters={filters} onChange={setFilters} />
                <Button size="sm" variant="secondary" onClick={resetFilters}>
                  Сбросить фильтры
                </Button>
              </div>
            }
          />
        </Suspense>
      </div>
    </div>
  );
}
