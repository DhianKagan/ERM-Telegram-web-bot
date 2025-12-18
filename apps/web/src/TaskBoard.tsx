// Назначение: канбан-доска задач с перетаскиванием
// Основные модули: React, @hello-pangea/dnd, сервис задач
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import TaskCard from './components/TaskCard';
import TaskDialog from './components/TaskDialog';
import useTasks from './context/useTasks';
import { useAuth } from './context/useAuth';
import { fetchKanban, updateTaskStatus } from './services/tasks';
import type { Task } from 'shared';
import { ACCESS_ADMIN, ACCESS_TASK_DELETE, hasAccess } from './utils/access';

const columns = ['Новая', 'В работе', 'Выполнена'];

type SortOption = 'title_asc' | 'title_desc';

type TransportFilter = 'any' | 'car' | 'truck' | 'none';

type FilterState = {
  search: string;
  transport: TransportFilter;
  sort: SortOption;
};

const DEFAULT_FILTERS: FilterState = {
  search: '',
  transport: 'any',
  sort: 'title_asc',
};

function normalizeTransport(value: string | null): TransportFilter {
  if (value === 'car' || value === 'truck' || value === 'none') {
    return value;
  }
  return 'any';
}

function normalizeSort(value: string | null): SortOption {
  if (value === 'title_desc') {
    return value;
  }
  return 'title_asc';
}

function areFiltersEqual(a: FilterState, b: FilterState): boolean {
  return (
    a.search === b.search && a.transport === b.transport && a.sort === b.sort
  );
}

type KanbanTask = Task & {
  dueDate?: string;
  due_date?: string;
  due?: string;
  request_id?: string;
  task_number?: string;
  created_by?: number;
  assigned_user_id?: number;
};

export default function TaskBoard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [filters, setFilters] = useState<FilterState>(() => ({
    ...DEFAULT_FILTERS,
  }));
  const [formState, setFormState] = useState<FilterState>(() => ({
    ...DEFAULT_FILTERS,
  }));
  const [params, setParams] = useSearchParams();
  const paramsSnapshot = params.toString();
  const open = params.get('newTask') !== null;
  const { version } = useTasks();
  const currentUserId =
    typeof user?.telegram_id === 'number' ? user.telegram_id : null;
  const accessMask = typeof user?.access === 'number' ? user.access : 0;
  const isAdmin =
    (user?.role ?? '').toLowerCase() === 'admin' ||
    hasAccess(accessMask, ACCESS_ADMIN) ||
    hasAccess(accessMask, ACCESS_TASK_DELETE);
  const collator = useMemo(
    () => new Intl.Collator('ru', { sensitivity: 'base', numeric: true }),
    [],
  );
  useEffect(() => {
    const current = new URLSearchParams(paramsSnapshot);
    const next: FilterState = {
      search: current.get('kanbanSearch') ?? '',
      transport: normalizeTransport(current.get('kanbanTransport')),
      sort: normalizeSort(current.get('kanbanSort')),
    };

    setFilters((prev) => (areFiltersEqual(prev, next) ? prev : next));
    setFormState((prev) => (areFiltersEqual(prev, next) ? prev : next));
  }, [paramsSnapshot]);

  const updateParamsWithFilters = useCallback(
    (nextFilters: FilterState) => {
      const nextParams = new URLSearchParams(paramsSnapshot);
      const searchValue = nextFilters.search.trim();

      if (searchValue) {
        nextParams.set('kanbanSearch', searchValue);
      } else {
        nextParams.delete('kanbanSearch');
      }

      if (nextFilters.transport !== 'any') {
        nextParams.set('kanbanTransport', nextFilters.transport);
      } else {
        nextParams.delete('kanbanTransport');
      }

      if (nextFilters.sort !== 'title_asc') {
        nextParams.set('kanbanSort', nextFilters.sort);
      } else {
        nextParams.delete('kanbanSort');
      }

      setParams(nextParams, { replace: true });
    },
    [paramsSnapshot, setParams],
  );
  const preparedTasks = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    const filtered = tasks.filter((task) => {
      const transportRaw =
        typeof task.transport_type === 'string'
          ? task.transport_type.trim()
          : '';
      const transportNormalized = transportRaw.toLowerCase();

      switch (filters.transport) {
        case 'car':
          if (transportNormalized !== 'легковой') return false;
          break;
        case 'truck':
          if (transportNormalized !== 'грузовой') return false;
          break;
        case 'none':
          if (transportNormalized && transportNormalized !== 'без транспорта') {
            return false;
          }
          break;
        default:
          break;
      }

      if (!normalizedSearch) {
        return true;
      }

      const title =
        typeof task.title === 'string' ? task.title.toLowerCase() : '';
      const requestId =
        typeof task.request_id === 'string'
          ? task.request_id.toLowerCase()
          : '';
      const taskNumber =
        typeof task.task_number === 'string'
          ? task.task_number.toLowerCase()
          : '';
      const taskId = typeof task._id === 'string' ? task._id.toLowerCase() : '';

      return [title, requestId, taskNumber, taskId].some((value) =>
        value.includes(normalizedSearch),
      );
    });

    return [...filtered].sort((a, b) => {
      const first = (() => {
        if (typeof a.title === 'string' && a.title.trim()) {
          return a.title.trim();
        }
        if (typeof a.task_number === 'string' && a.task_number.trim()) {
          return a.task_number.trim();
        }
        if (typeof a.request_id === 'string' && a.request_id.trim()) {
          return a.request_id.trim();
        }
        return a._id ?? '';
      })();

      const second = (() => {
        if (typeof b.title === 'string' && b.title.trim()) {
          return b.title.trim();
        }
        if (typeof b.task_number === 'string' && b.task_number.trim()) {
          return b.task_number.trim();
        }
        if (typeof b.request_id === 'string' && b.request_id.trim()) {
          return b.request_id.trim();
        }
        return b._id ?? '';
      })();

      if (filters.sort === 'title_desc') {
        return collator.compare(second, first);
      }
      return collator.compare(first, second);
    });
  }, [collator, filters, tasks]);
  const tasksByStatus = useMemo(() => {
    const map = new Map<string, KanbanTask[]>();
    for (const column of columns) {
      map.set(column, []);
    }
    for (const task of preparedTasks) {
      const list = map.get(task.status);
      if (!list) continue;
      list.push(task);
    }
    return map;
  }, [preparedTasks]);
  const totalTasks = preparedTasks.length;
  const layout = useMemo(() => {
    if (totalTasks > 60) {
      return {
        gapClass: 'gap-1.5',
        cardClass: 'min-w-[8.75rem] max-w-[11rem]',
      } as const;
    }
    if (totalTasks > 36) {
      return {
        gapClass: 'gap-2',
        cardClass: 'min-w-[9rem] max-w-[11.5rem]',
      } as const;
    }
    if (totalTasks > 18) {
      return {
        gapClass: 'gap-2.5',
        cardClass: 'min-w-[9.5rem] max-w-[12.5rem]',
      } as const;
    }
    return {
      gapClass: 'gap-3',
      cardClass: 'min-w-[10rem] max-w-[13rem]',
    } as const;
  }, [totalTasks]);

  useEffect(() => {
    let active = true;
    fetchKanban()
      .then((list) => {
        if (active) setTasks(list);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [version]);

  const onDragEnd = async ({ destination, draggableId }) => {
    if (!destination) return;
    const status = columns[Number(destination.droppableId)];
    const task = tasks.find((item) => item._id === draggableId);
    if (!task || task.status === status) return;
    const prevStatus = task.status;
    const creatorId = Number((task as { created_by?: unknown }).created_by);
    const assignedUserId = Number(
      (task as { assigned_user_id?: unknown }).assigned_user_id,
    );
    const assignees = Array.isArray(task.assignees) ? task.assignees : [];
    const isExecutor =
      (Number.isFinite(assignedUserId) && assignedUserId === currentUserId) ||
      (currentUserId !== null && assignees.includes(currentUserId));
    const isCreator = Number.isFinite(creatorId) && currentUserId === creatorId;
    const isTerminal = prevStatus === 'Выполнена' || prevStatus === 'Отменена';
    if (isTerminal && !isAdmin) {
      window.alert(t('taskSaveFailed'));
      return;
    }
    if (!(isExecutor || isCreator || isAdmin)) {
      window.alert(t('taskSaveFailed'));
      return;
    }
    setTasks((ts) =>
      ts.map((t) => (t._id === draggableId ? { ...t, status } : t)),
    );
    try {
      const res = await updateTaskStatus(draggableId, status);
      if (!res.ok) {
        setTasks((ts) =>
          ts.map((t) =>
            t._id === draggableId ? { ...t, status: prevStatus } : t,
          ),
        );
        window.alert(t('taskSaveFailed'));
      }
    } catch (error) {
      setTasks((ts) =>
        ts.map((t) =>
          t._id === draggableId ? { ...t, status: prevStatus } : t,
        ),
      );
      window.alert(t('taskSaveFailed'));
    }
  };

  const openTaskDialog = useCallback(
    (taskId: string) => {
      const trimmed = String(taskId || '').trim();
      if (!trimmed) return;
      const next = new URLSearchParams(params);
      next.set('task', trimmed);
      next.delete('newTask');
      setParams(next);
    },
    [params, setParams],
  );

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-2 md:flex-row">
        <Link
          to="/tasks"
          className={cn(buttonVariants({ variant: 'outline' }))}
        >
          Таблица
        </Link>
        <Button
          onClick={() => {
            const next = new URLSearchParams(params);
            next.set('newTask', '1');
            next.delete('task');
            setParams(next);
          }}
        >
          Новая задача
        </Button>
      </div>
      <section className="space-y-4 rounded border border-border bg-card/60 p-4 shadow-sm">
        <header className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-foreground">
            {t('kanban.filters.title')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('kanban.filters.result', { count: totalTasks })}
          </p>
        </header>
        <form
          className="flex flex-col gap-3 md:flex-row md:flex-wrap"
          onSubmit={(event) => {
            event.preventDefault();
            const nextFilters = { ...formState };
            setFilters(nextFilters);
            updateParamsWithFilters(nextFilters);
          }}
        >
          <div className="flex min-w-[12rem] flex-col gap-1">
            <label
              htmlFor="kanban-search"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              {t('kanban.filters.searchLabel')}
            </label>
            <Input
              id="kanban-search"
              value={formState.search}
              onChange={(event) => {
                const next = event.target.value;
                setFormState((prev) => ({ ...prev, search: next }));
              }}
              placeholder={t('kanban.filters.searchPlaceholder') ?? ''}
            />
          </div>
          <div className="flex min-w-[10rem] flex-col gap-1">
            <label
              htmlFor="kanban-transport"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              {t('kanban.filters.transportLabel')}
            </label>
            <select
              id="kanban-transport"
              value={formState.transport}
              onChange={(event) => {
                const next = event.target.value as TransportFilter;
                setFormState((prev) => ({ ...prev, transport: next }));
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="any">{t('kanban.filters.transportAny')}</option>
              <option value="car">{t('kanban.filters.transportCar')}</option>
              <option value="truck">
                {t('kanban.filters.transportTruck')}
              </option>
              <option value="none">{t('kanban.filters.transportNone')}</option>
            </select>
          </div>
          <div className="flex min-w-[10rem] flex-col gap-1">
            <label
              htmlFor="kanban-sort"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              {t('kanban.filters.sortLabel')}
            </label>
            <select
              id="kanban-sort"
              value={formState.sort}
              onChange={(event) => {
                const next = event.target.value as SortOption;
                setFormState((prev) => ({ ...prev, sort: next }));
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="title_asc">
                {t('kanban.filters.sortTitleAsc')}
              </option>
              <option value="title_desc">
                {t('kanban.filters.sortTitleDesc')}
              </option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit">{t('kanban.filters.apply')}</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const next = { ...DEFAULT_FILTERS };
                setFormState(next);
                setFilters(next);
                updateParamsWithFilters(next);
              }}
            >
              {t('reset')}
            </Button>
          </div>
        </form>
      </section>
      <div>
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex flex-col gap-6">
            {columns.map((key, idx) => {
              const columnTasks = tasksByStatus.get(key) ?? [];
              return (
                <Droppable
                  droppableId={String(idx)}
                  key={key}
                  direction="horizontal"
                >
                  {(provided) => (
                    <section className="rounded-lg bg-gray-100 p-3">
                      <h3 className="mb-3 font-semibold">
                        {key.replace('_', ' ')}
                      </h3>
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          'flex min-h-[11rem] flex-wrap content-start items-start pb-1',
                          layout.gapClass,
                        )}
                      >
                        {columnTasks.map((t, i) => (
                          <Draggable key={t._id} draggableId={t._id} index={i}>
                            {(prov) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                className={cn(
                                  'flex shrink-0',
                                  layout.cardClass,
                                )}
                                style={{ ...(prov.draggableProps.style ?? {}) }}
                              >
                                <TaskCard task={t} onOpen={openTaskDialog} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </section>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      </div>
      {open && (
        <TaskDialog
          onClose={() => {
            const next = new URLSearchParams(params);
            next.delete('newTask');
            setParams(next);
          }}
          onSave={() => {
            fetchKanban().then(setTasks);
          }}
        />
      )}
    </div>
  );
}
