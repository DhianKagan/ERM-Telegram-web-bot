// Страница архива задач
// Основные модули: React, SimpleTable, сервисы архива
import React from 'react';
import { ArchiveBoxIcon } from '@heroicons/react/24/outline';
import { SimpleTable } from '@/components/ui/simple-table';
import archiveColumns from '../columns/archiveColumns';
import { Button } from '@/components/ui/button';
import { FormGroup } from '@/components/ui/form-group';
import { Input } from '@/components/ui/input';
import FilterGrid from '@/components/FilterGrid';
import PageHeader from '@/components/PageHeader';
import { useToast } from '../context/useToast';
import { useAuth } from '../context/useAuth';
import { fetchArchive, purgeArchive } from '../services/archives';
import type { ArchiveTask } from '../types/archive';
import { ARCHIVE_ACCESS, ACCESS_TASK_DELETE, hasAccess } from '../utils/access';

const PAGE_SIZE = 25;

const toId = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    try {
      return (value as { toString(): string }).toString();
    } catch {
      return '';
    }
  }
  return '';
};

const normalizeDate = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return undefined;
};

export default function ArchivePage() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [rows, setRows] = React.useState<ArchiveTask[]>([]);
  const [page, setPage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [purging, setPurging] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [appliedSearch, setAppliedSearch] = React.useState('');
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const access = typeof user?.access === 'number' ? user.access : 0;
  const canViewArchive = hasAccess(access, ARCHIVE_ACCESS);
  const canPurge = hasAccess(access, ACCESS_TASK_DELETE);

  const visibleCount = React.useMemo(
    () => rows.filter((row) => row.id).length,
    [rows],
  );

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchArchive({
          page: page + 1,
          limit: PAGE_SIZE,
          search: appliedSearch || undefined,
        });
        if (cancelled) return;
        const mapped = data.items.map((item) => {
          const record = item as Record<string, unknown>;
          const id = toId(record._id ?? record.id ?? record.task_number ?? '');
          return {
            id,
            task_number:
              typeof record.task_number === 'string'
                ? record.task_number
                : undefined,
            title: typeof record.title === 'string' ? record.title : undefined,
            status:
              typeof record.status === 'string' ? record.status : undefined,
            archived_at: normalizeDate(record.archived_at),
            createdAt: normalizeDate(record.createdAt),
            archived_by:
              typeof record.archived_by === 'number' &&
              Number.isFinite(record.archived_by)
                ? (record.archived_by as number)
                : undefined,
          } satisfies ArchiveTask;
        });
        setRows(mapped);
        setTotal(data.total);
        setPageCount(data.pages);
        setSelectedIds((prev) => {
          const next = new Set<string>();
          mapped.forEach((row) => {
            if (row.id && prev.has(row.id)) {
              next.add(row.id);
            }
          });
          return next;
        });
        const maxPageIndex = Math.max((data.pages || 1) - 1, 0);
        if (page > maxPageIndex) {
          setPage(maxPageIndex);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : 'Не удалось загрузить архив задач';
          addToast(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    if (canViewArchive) {
      void load();
    }
    return () => {
      cancelled = true;
    };
  }, [page, appliedSearch, refreshKey, canViewArchive, addToast]);

  const handleSearchSubmit = React.useCallback(() => {
    setAppliedSearch(search.trim());
    setPage(0);
  }, [search]);

  const handleSearchReset = React.useCallback(() => {
    setSearch('');
    setAppliedSearch('');
    setPage(0);
  }, []);

  const handleToggleRow = React.useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleToggleAll = React.useCallback(
    (checked: boolean) => {
      if (checked) {
        const next = new Set<string>();
        rows.forEach((row) => {
          if (row.id) {
            next.add(row.id);
          }
        });
        setSelectedIds(next);
      } else {
        setSelectedIds(new Set());
      }
    },
    [rows],
  );

  const handlePurge = React.useCallback(async () => {
    if (!selectedIds.size) return;
    setPurging(true);
    try {
      const removed = await purgeArchive(Array.from(selectedIds));
      if (removed > 0) {
        addToast(`Удалено ${removed} задач`, 'success');
      } else {
        addToast('Задачи не были удалены', 'error');
      }
      setSelectedIds(new Set());
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Не удалось выполнить полное удаление';
      addToast(message, 'error');
    } finally {
      setPurging(false);
    }
  }, [selectedIds, addToast]);

  const columns = React.useMemo(
    () =>
      archiveColumns({
        enableSelection: canPurge,
        selectedIds,
        onToggleRow: handleToggleRow,
        onToggleAll: handleToggleAll,
        visibleCount,
      }),
    [canPurge, selectedIds, handleToggleRow, handleToggleAll, visibleCount],
  );

  if (!canViewArchive) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Архив задач</h1>
        <p className="text-sm text-muted-foreground">
          Недостаточно прав для просмотра архива.
        </p>
      </div>
    );
  }

  const totalLabel = (() => {
    const remainder10 = total % 10;
    const remainder100 = total % 100;
    if (remainder10 === 1 && remainder100 !== 11) return 'задача';
    if ([2, 3, 4].includes(remainder10) && ![12, 13, 14].includes(remainder100))
      return 'задачи';
    return 'задач';
  })();

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ArchiveBoxIcon}
        title="Архив задач"
        description="Здесь отображаются удалённые задачи только для чтения."
        filters={
          <FilterGrid
            variant="plain"
            onSearch={handleSearchSubmit}
            onReset={handleSearchReset}
            actions={
              canPurge ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!selectedIds.size || purging || loading}
                  onClick={handlePurge}
                >
                  Полное удаление
                </Button>
              ) : null
            }
          >
            <FormGroup label="Поиск" htmlFor="archive-search">
              <Input
                id="archive-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск по номеру или названию"
                aria-label="Поиск по архиву"
              />
            </FormGroup>
          </FilterGrid>
        }
      />
      {loading ? (
        <div className="text-sm text-muted-foreground">Загрузка архива...</div>
      ) : null}
      <SimpleTable<ArchiveTask>
        columns={columns}
        data={rows}
        pageIndex={page}
        pageSize={PAGE_SIZE}
        pageCount={pageCount}
        onPageChange={setPage}
        showGlobalSearch={false}
        showFilters={false}
        wrapCellsAsBadges
        rowHeight={56}
      />
      <div className="text-sm text-muted-foreground">
        Найдено {total} {totalLabel}
      </div>
    </div>
  );
}
