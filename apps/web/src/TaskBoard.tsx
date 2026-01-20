// Назначение: канбан-доска задач с перетаскиванием
// Основные модули: React, dnd-kit, сервис задач
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormGroup } from '@/components/ui/form-group';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import ActionsDropdown from './components/ActionsDropdown';
import TaskCard from './components/TaskCard';
import TaskDialog from './components/TaskDialog';
import useTasks from './context/useTasks';
import { useAuth } from './context/useAuth';
import { fetchKanban, updateTaskStatus } from './services/tasks';
import type { Task } from 'shared';
import { ACCESS_ADMIN, ACCESS_TASK_DELETE, hasAccess } from './utils/access';

const columns = ['Новая', 'В работе', 'Выполнена'];

type SortOption =
  | 'title_asc'
  | 'title_desc'
  | 'number_asc'
  | 'type_asc'
  | 'status_asc'
  | 'priority_asc'
  | 'executor_asc'
  | 'creator_asc'
  | 'driver_asc'
  | 'transport_asc';

type TransportFilter = 'any' | 'car' | 'truck' | 'none';

type FilterState = {
  search: string;
  transport: TransportFilter;
  sort: SortOption;
};

type LayoutConfig = {
  gapClass: string;
  cardClass: string;
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      window.clearTimeout(handle);
    };
  }, [value, delayMs]);
  return debounced;
}

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
  switch (value) {
    case 'title_desc':
    case 'number_asc':
    case 'type_asc':
    case 'status_asc':
    case 'priority_asc':
    case 'executor_asc':
    case 'creator_asc':
    case 'driver_asc':
    case 'transport_asc':
      return value;
    default:
      return 'title_asc';
  }
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

const normalizeSearchToken = (value: string): string =>
  value.trim().toLowerCase();

const pushSearchValue = (target: string[], value: unknown) => {
  if (typeof value === 'string') {
    const normalized = normalizeSearchToken(value);
    if (normalized) target.push(normalized);
    return;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    target.push(String(value));
  }
};

const collectSearchValues = (task: KanbanTask): string[] => {
  const values: string[] = [];
  const record = task as Record<string, unknown>;
  [
    task.title,
    task.task_number,
    task.request_id,
    task._id,
    task.status,
    task.priority,
    record.task_type,
    record.transport_type,
    record.transport_driver_name,
    record.transport_vehicle_name,
    record.transport_vehicle_registration,
    record.assignee_name,
    record.assigned_user_name,
    record.assignees_names,
    record.creator_name,
    record.created_by_name,
    record.createdByName,
  ].forEach((value) => pushSearchValue(values, value));

  pushSearchValue(values, record.transport_driver_id);
  pushSearchValue(values, record.created_by);
  pushSearchValue(values, record.assigned_user_id);

  if (Array.isArray(task.assignees)) {
    task.assignees.forEach((value) => pushSearchValue(values, value));
  }

  return values;
};

const resolveSortText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const resolveTaskNumber = (task: KanbanTask): string => {
  const candidates = [task.task_number, task.request_id, task._id];
  for (const value of candidates) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return '';
};

const resolveExecutor = (task: KanbanTask): string => {
  const record = task as Record<string, unknown>;
  const candidate =
    resolveSortText(record.assignee_name) ||
    resolveSortText(record.assigned_user_name) ||
    resolveSortText(record.assignees_names);
  if (candidate) return candidate;
  const assignees = Array.isArray(task.assignees) ? task.assignees : [];
  if (assignees.length > 0) return String(assignees[0]);
  if (typeof record.assigned_user_id === 'number') {
    return String(record.assigned_user_id);
  }
  return '';
};

const resolveCreator = (task: KanbanTask): string => {
  const record = task as Record<string, unknown>;
  const candidate =
    resolveSortText(record.creator_name) ||
    resolveSortText(record.created_by_name) ||
    resolveSortText(record.createdByName);
  if (candidate) return candidate;
  if (typeof record.created_by === 'number') {
    return String(record.created_by);
  }
  return '';
};

const resolveDriver = (task: KanbanTask): string => {
  const record = task as Record<string, unknown>;
  const name = resolveSortText(record.transport_driver_name);
  if (name) return name;
  if (typeof record.transport_driver_id === 'number') {
    return String(record.transport_driver_id);
  }
  return '';
};

const resolveTransport = (task: KanbanTask): string => {
  const record = task as Record<string, unknown>;
  return (
    resolveSortText(record.transport_type) ||
    resolveSortText(record.transport_vehicle_name) ||
    resolveSortText(record.transport_vehicle_registration)
  );
};

const statusOrder = new Map([
  ['Новая', 0],
  ['В работе', 1],
  ['Выполнена', 2],
  ['Отменена', 3],
]);

const priorityOrder = new Map([
  ['Срочно', 0],
  ['В течение дня', 1],
  ['До выполнения', 2],
]);

const resolveOrderValue = (value: string, orderMap: Map<string, number>) => {
  const order = orderMap.get(value);
  return typeof order === 'number' ? order : orderMap.size + 1;
};

type SortableTaskCardProps = {
  task: KanbanTask;
  onOpen: (taskId: string) => void;
  cardClass: string;
};

function SortableTaskCard({ task, onOpen, cardClass }: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id,
    data: { column: task.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : 1,
  } as const;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className={cn(
        'flex shrink-0 cursor-grab active:cursor-grabbing',
        cardClass,
      )}
    >
      <TaskCard task={task} onOpen={onOpen} />
    </div>
  );
}

type KanbanColumnProps = {
  status: string;
  tasks: KanbanTask[];
  layout: LayoutConfig;
  onOpen: (taskId: string) => void;
};

function KanbanColumn({ status, tasks, layout, onOpen }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { column: status },
  });

  return (
    <section className="rounded-lg bg-gray-100 p-3">
      <h3 className="mb-3 font-semibold">{status.replace('_', ' ')}</h3>
      <SortableContext
        id={status}
        items={tasks.map((task) => task._id)}
        strategy={rectSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn(
            'flex min-h-[11rem] flex-wrap content-start items-start pb-1',
            layout.gapClass,
            isOver && 'ring-2 ring-primary/40',
          )}
        >
          {tasks.map((task) => (
            <SortableTaskCard
              key={task._id}
              task={task}
              onOpen={onOpen}
              cardClass={layout.cardClass}
            />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

export default function TaskBoard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [filters, setFilters] = useState<FilterState>(() => ({
    ...DEFAULT_FILTERS,
  }));
  const [formState, setFormState] = useState<FilterState>(() => ({
    ...DEFAULT_FILTERS,
  }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState(DEFAULT_FILTERS.search);
  const [params, setParams] = useSearchParams();
  const paramsSnapshot = params.toString();
  const open = params.get('newTask') !== null;
  const { version } = useTasks();
  const currentUserId =
    typeof user?.telegram_id === 'number' ? user.telegram_id : null;
  const accessMask = typeof user?.access === 'number' ? user.access : 0;
  const sortSelectRef = useRef<HTMLSelectElement | null>(null);
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
    setSearchDraft(next.search);
  }, [paramsSnapshot]);

  const debouncedSearch = useDebouncedValue(searchDraft, 300);
  useEffect(() => {
    setFormState((prev) =>
      prev.search === debouncedSearch
        ? prev
        : { ...prev, search: debouncedSearch },
    );
  }, [debouncedSearch]);

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
    const normalizedSearch = normalizeSearchToken(filters.search);
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

      if (!normalizedSearch) return true;
      const tokens = normalizedSearch
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean);
      if (!tokens.length) return true;
      const haystack = collectSearchValues(task);
      if (!haystack.length) return false;
      return tokens.every((token) =>
        haystack.some((value) => value.includes(token)),
      );
    });

    return [...filtered].sort((a, b) => {
      if (filters.sort === 'status_asc') {
        return (
          resolveOrderValue(resolveSortText(a.status), statusOrder) -
          resolveOrderValue(resolveSortText(b.status), statusOrder)
        );
      }
      if (filters.sort === 'priority_asc') {
        return (
          resolveOrderValue(resolveSortText(a.priority), priorityOrder) -
          resolveOrderValue(resolveSortText(b.priority), priorityOrder)
        );
      }

      const first = (() => {
        switch (filters.sort) {
          case 'title_desc':
          case 'title_asc':
            return resolveSortText(a.title) || resolveTaskNumber(a);
          case 'number_asc':
            return resolveTaskNumber(a);
          case 'type_asc':
            return resolveSortText((a as Record<string, unknown>).task_type);
          case 'executor_asc':
            return resolveExecutor(a);
          case 'creator_asc':
            return resolveCreator(a);
          case 'driver_asc':
            return resolveDriver(a);
          case 'transport_asc':
            return resolveTransport(a);
          default:
            return resolveTaskNumber(a);
        }
      })();

      const second = (() => {
        switch (filters.sort) {
          case 'title_desc':
          case 'title_asc':
            return resolveSortText(b.title) || resolveTaskNumber(b);
          case 'number_asc':
            return resolveTaskNumber(b);
          case 'type_asc':
            return resolveSortText((b as Record<string, unknown>).task_type);
          case 'executor_asc':
            return resolveExecutor(b);
          case 'creator_asc':
            return resolveCreator(b);
          case 'driver_asc':
            return resolveDriver(b);
          case 'transport_asc':
            return resolveTransport(b);
          default:
            return resolveTaskNumber(b);
        }
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
        cardClass: 'min-w-[8.75rem] max-w-[11rem] h-[8.5rem]',
      } as const;
    }
    if (totalTasks > 36) {
      return {
        gapClass: 'gap-2',
        cardClass: 'min-w-[9rem] max-w-[11.5rem] h-[9rem]',
      } as const;
    }
    if (totalTasks > 18) {
      return {
        gapClass: 'gap-2.5',
        cardClass: 'min-w-[9.5rem] max-w-[12.5rem] h-[9.5rem]',
      } as const;
    }
    return {
      gapClass: 'gap-3',
      cardClass: 'min-w-[10rem] max-w-[13rem] h-[10rem]',
    } as const;
  }, [totalTasks]);

  const openNewTaskDialog = useCallback(() => {
    const next = new URLSearchParams(params);
    next.set('newTask', '1');
    next.delete('task');
    setParams(next);
  }, [params, setParams]);

  const handleExport = useCallback(() => {
    const fileName = `kanban-tasks-${new Date().toISOString().slice(0, 10)}.json`;
    const payload = JSON.stringify(preparedTasks, null, 2);
    const blob = new Blob([payload], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [preparedTasks]);

  const applyFilters = useCallback(
    (nextFilters: FilterState) => {
      setFilters(nextFilters);
      updateParamsWithFilters(nextFilters);
    },
    [updateParamsWithFilters],
  );

  const resetFilters = useCallback(() => {
    const next = { ...DEFAULT_FILTERS };
    setSearchDraft(next.search);
    setFormState(next);
    setFilters(next);
    updateParamsWithFilters(next);
  }, [updateParamsWithFilters]);

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const droppableStatus =
        typeof over.data.current?.column === 'string'
          ? (over.data.current.column as string)
          : undefined;
      const status =
        droppableStatus ?? columns.find((item) => item === over.id);
      const draggableId = String(active.id);
      const task = tasks.find((item) => item._id === draggableId);

      if (!status || !task || task.status === status) return;
      const prevStatus = task.status;
      const creatorId = Number((task as { created_by?: unknown }).created_by);
      const assignedUserId = Number(
        (task as { assigned_user_id?: unknown }).assigned_user_id,
      );
      const assignees = Array.isArray(task.assignees) ? task.assignees : [];
      const isExecutor =
        (Number.isFinite(assignedUserId) && assignedUserId === currentUserId) ||
        (currentUserId !== null && assignees.includes(currentUserId));
      const isCreator =
        Number.isFinite(creatorId) && currentUserId === creatorId;
      const isTerminal =
        prevStatus === 'Выполнена' || prevStatus === 'Отменена';

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
    },
    [currentUserId, isAdmin, t, tasks],
  );

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

  const FiltersForm = ({
    className,
    actionsClassName,
    onAfterSubmit,
  }: {
    className?: string;
    actionsClassName?: string;
    onAfterSubmit?: () => void;
  }) => (
    <form
      className={cn('space-y-4', className)}
      onSubmit={(event) => {
        event.preventDefault();
        const nextFilters = { ...formState, search: searchDraft };
        setFormState(nextFilters);
        applyFilters(nextFilters);
        onAfterSubmit?.();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          resetFilters();
        }
      }}
    >
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FormGroup
          label={t('kanban.filters.searchLabel')}
          htmlFor="kanban-search"
        >
          <Input
            id="kanban-search"
            className="w-full"
            value={searchDraft}
            onChange={(event) => {
              setSearchDraft(event.target.value);
            }}
            placeholder={t('kanban.filters.searchPlaceholder') ?? ''}
          />
        </FormGroup>
        <FormGroup
          label={t('kanban.filters.transportLabel')}
          htmlFor="kanban-transport"
        >
          <Select
            id="kanban-transport"
            value={formState.transport}
            onChange={(event) => {
              const next = event.target.value as TransportFilter;
              setFormState((prev) => ({ ...prev, transport: next }));
            }}
          >
            <option value="any">{t('kanban.filters.transportAny')}</option>
            <option value="car">{t('kanban.filters.transportCar')}</option>
            <option value="truck">{t('kanban.filters.transportTruck')}</option>
            <option value="none">{t('kanban.filters.transportNone')}</option>
          </Select>
        </FormGroup>
        <FormGroup label={t('kanban.filters.sortLabel')} htmlFor="kanban-sort">
          <Select
            id="kanban-sort"
            ref={sortSelectRef}
            value={formState.sort}
            onChange={(event) => {
              const next = event.target.value as SortOption;
              setFormState((prev) => ({ ...prev, sort: next }));
            }}
          >
            <option value="title_asc">
              {t('kanban.filters.sortTitleAsc')}
            </option>
            <option value="title_desc">
              {t('kanban.filters.sortTitleDesc')}
            </option>
            <option value="number_asc">
              {t('kanban.filters.sortNumberAsc')}
            </option>
            <option value="type_asc">{t('kanban.filters.sortTypeAsc')}</option>
            <option value="status_asc">
              {t('kanban.filters.sortStatusAsc')}
            </option>
            <option value="priority_asc">
              {t('kanban.filters.sortPriorityAsc')}
            </option>
            <option value="executor_asc">
              {t('kanban.filters.sortExecutorAsc')}
            </option>
            <option value="creator_asc">
              {t('kanban.filters.sortCreatorAsc')}
            </option>
            <option value="driver_asc">
              {t('kanban.filters.sortDriverAsc')}
            </option>
            <option value="transport_asc">
              {t('kanban.filters.sortTransportAsc')}
            </option>
          </Select>
        </FormGroup>
      </div>
      <div
        className={cn(
          'flex flex-wrap items-center justify-end gap-2',
          actionsClassName,
        )}
      >
        <Button
          type="submit"
          size="sm"
          variant="primary"
          className="min-w-[7rem]"
        >
          {t('kanban.filters.apply')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-w-[7rem]"
          onClick={() => {
            resetFilters();
          }}
        >
          {t('reset')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="success"
          className="min-w-[7rem]"
          onClick={openNewTaskDialog}
        >
          Новая задача
        </Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link to="/tasks">Таблица</Link>
          </Button>
        </div>
      </div>
      <section className="space-y-4 rounded border border-border bg-card/60 p-4 shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">
              {t('kanban.filters.title')}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t('kanban.filters.result', { count: totalTasks })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="sm:hidden"
              onClick={() => setFiltersOpen(true)}
            >
              Фильтры
            </Button>
            <ActionsDropdown
              onManage={() => navigate('/tasks')}
              onExport={handleExport}
              onSettings={() => navigate('/cp/settings')}
              onSort={() => sortSelectRef.current?.focus()}
            />
          </div>
        </header>
        <div className="hidden sm:block">
          <FiltersForm />
        </div>
      </section>
      <div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          autoScroll
          onDragEnd={onDragEnd}
        >
          <div className="flex flex-col gap-6">
            {columns.map((key) => (
              <KanbanColumn
                key={key}
                status={key}
                tasks={tasksByStatus.get(key) ?? []}
                layout={layout}
                onOpen={openTaskDialog}
              />
            ))}
          </div>
        </DndContext>
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
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Фильтры задач</DialogTitle>
          </DialogHeader>
          <FiltersForm onAfterSubmit={() => setFiltersOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
