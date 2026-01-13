// Компонент просмотра логов на React Table
// Модули: React, useLogsQuery, FiltersPanel, SimpleTable, logColumns
import React from 'react';

import ActionBar from './ActionBar';
import Breadcrumbs from './Breadcrumbs';
import FiltersPanel from './FiltersPanel';
import logColumns from '../columns/logColumns';
import useLogsQuery, { LogFilters } from '../hooks/useLogsQuery';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SimpleTable } from '@/components/ui/simple-table';
import Spinner from './Spinner';
import { DocumentTextIcon } from '@heroicons/react/24/outline';

export default function LogViewer() {
  const [filters, setFilters] = React.useState<LogFilters>({});
  const [live, setLive] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const {
    data: logs = [],
    isFetching,
    refetch,
  } = useLogsQuery(filters, page + 1, { live });

  const resetFilters = React.useCallback(() => setFilters({}), []);
  const refreshNow = React.useCallback(() => {
    void refetch();
  }, [refetch]);

  React.useEffect(() => {
    setPage(0);
  }, [filters]);

  return (
    <div className="space-y-4">
      <ActionBar
        breadcrumbs={<Breadcrumbs items={[{ label: 'Журнал событий' }]} />}
        icon={DocumentTextIcon}
        title="Журнал событий"
        description="Технические логи приложения в едином формате."
        filters={
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              refreshNow();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                resetFilters();
              }
            }}
          >
            <FiltersPanel filters={filters} onChange={setFilters} />
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="primary" type="submit">
                Искать
              </Button>
              <Button size="sm" variant="outline" onClick={resetFilters}>
                Сбросить
              </Button>
              <label
                className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-muted)] shadow-[var(--shadow-sm)]"
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
            </div>
          </form>
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={refreshNow}>
              Обновить
            </Button>
          </div>
        }
      />

      <Card>
        {isFetching && logs.length === 0 ? (
          <div className="flex min-h-[12rem] items-center justify-center">
            <Spinner className="h-5 w-5 text-[color:var(--color-brand-500)]" />
          </div>
        ) : (
          <SimpleTable
            columns={logColumns}
            data={logs}
            pageIndex={page}
            pageSize={50}
            onPageChange={setPage}
            showGlobalSearch={false}
            showFilters={false}
          />
        )}
      </Card>
    </div>
  );
}
