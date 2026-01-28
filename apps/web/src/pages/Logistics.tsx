// Страница отображения маршрутных листов в виде карточек
// Основные модули: React, listRoutePlans, компоненты интерфейса
import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  CheckCircleIcon,
  PencilSquareIcon,
  PlayIcon,
  Squares2X2Icon,
  TableCellsIcon,
  TrashIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import type {
  RoutePlan,
  RoutePlanRoute,
  RoutePlanStatus,
  RoutePlanTaskRef,
} from 'shared';

import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ConfirmDialog';
import StatusBadge, { mapStatusTone } from '@/components/ui/StatusBadge';
import { FormGroup } from '@/components/ui/form-group';
import { Select } from '@/components/ui/select';
import {
  SimpleTable,
  type SimpleTableAction,
} from '@/components/ui/simple-table';
import UnifiedSearch from '@/components/UnifiedSearch';
import Breadcrumbs from '../components/Breadcrumbs';
import ActionBar from '../components/ActionBar';
import SkeletonCard from '../components/SkeletonCard';
import RoutePlanDialog from './RoutePlanDialog';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import {
  changeRoutePlanStatus,
  deleteRoutePlan,
  listRoutePlans,
} from '../services/routePlans';
import { ACCESS_ADMIN, ACCESS_MANAGER, hasAccess } from '../utils/access';
import { expandSearchTokens } from '../utils/searchSynonyms';

const STATUS_LABELS: Record<RoutePlanStatus | 'cancelled', string> = {
  draft: 'Новый',
  approved: 'В работе',
  completed: 'Выполнен',
  cancelled: 'Отменен',
};

const STATUS_OPTIONS: Array<{
  value: RoutePlanStatus | 'cancelled' | 'all';
  label: string;
}> = [
  { value: 'all', label: 'Все' },
  { value: 'draft', label: STATUS_LABELS.draft },
  { value: 'approved', label: STATUS_LABELS.approved },
  { value: 'completed', label: STATUS_LABELS.completed },
  { value: 'cancelled', label: STATUS_LABELS.cancelled },
];

const formatDate = (value?: string): string => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const collectTasks = (routes: RoutePlanRoute[]): string[] => {
  const names = new Set<string>();
  routes.forEach((route) => {
    route.tasks.forEach((task: RoutePlanTaskRef) => {
      const label = task.title?.trim() || task.taskId;
      if (label) {
        names.add(label);
      }
    });
  });
  return Array.from(names);
};

const collectDrivers = (routes: RoutePlanRoute[]): string => {
  const drivers = new Set<string>();
  routes.forEach((route) => {
    if (route.driverName) {
      drivers.add(route.driverName);
    }
  });
  return drivers.size > 0 ? Array.from(drivers).join(', ') : 'Не назначен';
};

const collectVehicles = (routes: RoutePlanRoute[]): string => {
  const vehicles = new Set<string>();
  routes.forEach((route) => {
    if (route.vehicleName) {
      vehicles.add(route.vehicleName);
    }
  });
  return vehicles.size > 0 ? Array.from(vehicles).join(', ') : 'Не назначено';
};

const normalizeStatus = (
  status?: RoutePlanStatus | string,
): RoutePlanStatus | 'cancelled' => {
  if (status === 'draft' || status === 'approved' || status === 'completed') {
    return status;
  }
  return 'cancelled';
};

const normalizeCandidate = (value: string): string[] => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return [];
  const collapsed = trimmed.replace(/[\s\-_/.]+/g, '');
  if (collapsed && collapsed !== trimmed) {
    return [trimmed, collapsed];
  }
  return [trimmed];
};

const pushCandidate = (target: Set<string>, value: unknown) => {
  if (typeof value === 'string') {
    normalizeCandidate(value).forEach((candidate) => target.add(candidate));
    return;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    normalizeCandidate(String(value)).forEach((candidate) =>
      target.add(candidate),
    );
  }
};

const collectPlanSearchValues = (plan: RoutePlan): string[] => {
  const values = new Set<string>();
  pushCandidate(values, plan.id);
  pushCandidate(values, plan.title);
  pushCandidate(values, plan.notes);
  pushCandidate(values, plan.status);
  pushCandidate(values, plan.createdAt);
  pushCandidate(values, plan.updatedAt);
  pushCandidate(values, plan.metrics?.totalDistanceKm);
  pushCandidate(values, plan.metrics?.totalTasks);
  pushCandidate(values, plan.metrics?.totalRoutes);
  pushCandidate(values, plan.metrics?.totalStops);

  plan.tasks?.forEach((taskId) => pushCandidate(values, taskId));
  (plan.routes ?? []).forEach((route) => {
    pushCandidate(values, route.driverName);
    pushCandidate(values, route.vehicleName);
    pushCandidate(values, route.notes);
    route.tasks?.forEach((task) => {
      pushCandidate(values, task.taskId);
      pushCandidate(values, task.title);
      pushCandidate(values, task.startAddress);
      pushCandidate(values, task.finishAddress);
    });
    route.stops?.forEach((stop) => {
      pushCandidate(values, stop.address);
      pushCandidate(values, stop.taskId);
    });
  });

  return Array.from(values);
};

const matchPlanQuery = (plan: RoutePlan, query: string): boolean => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const tokenGroups = expandSearchTokens(trimmed);
  if (!tokenGroups.length) return true;
  const haystack = collectPlanSearchValues(plan);
  if (!haystack.length) return false;
  return tokenGroups.every((group) => {
    const variations = group.flatMap((token) => normalizeCandidate(token));
    return variations.some((variant) =>
      haystack.some((candidate) => candidate.includes(variant)),
    );
  });
};

export default function Logistics() {
  const [plans, setPlans] = React.useState<RoutePlan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<
    RoutePlanStatus | 'cancelled' | 'all'
  >('all');
  const [searchDraft, setSearchDraft] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [viewMode, setViewMode] = React.useState<'cards' | 'table'>('cards');
  const [pageIndex, setPageIndex] = React.useState(0);
  const [deletePlan, setDeletePlan] = React.useState<RoutePlan | null>(null);
  const [updatingPlanId, setUpdatingPlanId] = React.useState<string | null>(
    null,
  );
  const [deletingPlanId, setDeletingPlanId] = React.useState<string | null>(
    null,
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogPlanId, setDialogPlanId] = React.useState<string | null>(null);
  const { addToast } = useToast();
  const { user } = useAuth();

  const loadPlans = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listRoutePlans();
      setPlans(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Не удалось загрузить маршрутные листы';
      setError(message);
      addToast(message);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const applySearch = React.useCallback(() => {
    setSearch(searchDraft.trim());
    setPageIndex(0);
  }, [searchDraft]);

  const resetSearch = React.useCallback(() => {
    setSearchDraft('');
    setSearch('');
    setPageIndex(0);
  }, []);

  const handleStatusChange = React.useCallback(
    async (planId: string, status: RoutePlanStatus) => {
      if (!planId) return;
      setUpdatingPlanId(planId);
      try {
        const updated = await changeRoutePlanStatus(planId, status);
        setPlans((prev) =>
          prev.map((plan) => (plan.id === planId ? updated : plan)),
        );
        addToast('Статус маршрутного листа обновлен');
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Не удалось обновить маршрутный лист';
        addToast(message);
      } finally {
        setUpdatingPlanId(null);
      }
    },
    [addToast],
  );

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deletePlan) return;
    setDeletingPlanId(deletePlan.id);
    try {
      await deleteRoutePlan(deletePlan.id);
      setPlans((prev) => prev.filter((plan) => plan.id !== deletePlan.id));
      addToast('Маршрутный лист удален');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Не удалось удалить маршрутный лист';
      addToast(message);
    } finally {
      setDeletingPlanId(null);
      setDeletePlan(null);
    }
  }, [addToast, deletePlan]);

  const openCreateDialog = React.useCallback(() => {
    setDialogPlanId(null);
    setDialogOpen(true);
  }, []);

  const openEditDialog = React.useCallback((planId: string) => {
    setDialogPlanId(planId);
    setDialogOpen(true);
  }, []);

  const closeDialog = React.useCallback(() => {
    setDialogOpen(false);
    setDialogPlanId(null);
  }, []);

  const handleDialogSaved = React.useCallback(
    (plan: RoutePlan) => {
      setPlans((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === plan.id);
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = plan;
          return next;
        }
        return [plan, ...prev];
      });
      addToast(
        dialogPlanId ? 'Маршрутный лист обновлен' : 'Маршрутный лист создан',
      );
    },
    [addToast, dialogPlanId],
  );

  const filteredPlans = React.useMemo(() => {
    return plans.filter((plan) => {
      if (statusFilter !== 'all') {
        if (normalizeStatus(plan.status) !== statusFilter) return false;
      }
      if (search && !matchPlanQuery(plan, search)) return false;
      return true;
    });
  }, [plans, search, statusFilter]);

  React.useEffect(() => {
    setPageIndex(0);
  }, [search, statusFilter]);

  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filteredPlans.length / pageSize));
  const pagedPlans = React.useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredPlans.slice(start, start + pageSize);
  }, [filteredPlans, pageIndex, pageSize]);

  const access = typeof user?.access === 'number' ? user.access : 0;
  const isAdmin = user?.role === 'admin' || hasAccess(access, ACCESS_ADMIN);
  const isManager = hasAccess(access, ACCESS_MANAGER);
  const isManaging = isAdmin || isManager;

  const statusSelectOptions = React.useMemo(
    () =>
      STATUS_OPTIONS.filter(
        (option) => option.value !== 'all' && option.value !== 'cancelled',
      ) as Array<{ value: RoutePlanStatus; label: string }>,
    [],
  );

  const columns = React.useMemo<ColumnDef<RoutePlan>[]>(() => {
    return [
      {
        header: 'Маршрутный лист',
        accessorKey: 'title',
        cell: ({ row }) => (
          <div className="min-w-0 space-y-1">
            <p className="font-medium text-foreground">{row.original.title}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.notes || '—'}
            </p>
          </div>
        ),
        meta: { minWidth: '16rem', truncate: false },
      },
      {
        header: 'Статус',
        cell: ({ row }) => {
          const status = normalizeStatus(row.original.status);
          const label = STATUS_LABELS[status] ?? status;
          return (
            <StatusBadge
              status={label}
              tone={mapStatusTone(status)}
              className="whitespace-nowrap"
            />
          );
        },
        meta: { minWidth: '8rem', align: 'center' },
      },
      {
        header: 'Создан',
        cell: ({ row }) => formatDate(row.original.createdAt),
        meta: { minWidth: '10rem' },
      },
      {
        header: 'Водитель',
        cell: ({ row }) => collectDrivers(row.original.routes ?? []),
        meta: { minWidth: '10rem' },
      },
      {
        header: 'Авто',
        cell: ({ row }) => collectVehicles(row.original.routes ?? []),
        meta: { minWidth: '10rem' },
      },
      {
        header: 'Задачи',
        cell: ({ row }) => {
          const tasks = collectTasks(row.original.routes ?? []);
          return tasks.length ? tasks.join(', ') : '—';
        },
        meta: { minWidth: '14rem', truncate: false },
      },
      {
        header: 'Маршруты',
        cell: ({ row }) => row.original.routes?.length ?? 0,
        meta: { minWidth: '6rem', align: 'center' },
      },
    ];
  }, []);

  const rowActions = React.useCallback(
    (plan: RoutePlan): SimpleTableAction<RoutePlan>[] => {
      if (!isManaging) return [];
      const actions: SimpleTableAction<RoutePlan>[] = [];
      actions.push({
        label: 'Редактировать',
        onClick: () => openEditDialog(plan.id),
        variant: 'outline',
        icon: <PencilSquareIcon className="size-4" />,
      });
      if (plan.status !== 'approved') {
        actions.push({
          label: 'В работу',
          onClick: () => void handleStatusChange(plan.id, 'approved'),
          variant: 'outline',
          icon: <PlayIcon className="size-4" />,
          disabled: updatingPlanId === plan.id,
        });
      }
      if (plan.status !== 'completed') {
        actions.push({
          label: 'Завершить',
          onClick: () => void handleStatusChange(plan.id, 'completed'),
          variant: 'outline',
          icon: <CheckCircleIcon className="size-4" />,
          disabled: updatingPlanId === plan.id,
        });
      }
      actions.push({
        label: 'Удалить',
        onClick: () => setDeletePlan(plan),
        variant: 'destructive',
        icon: <TrashIcon className="size-4" />,
        disabled: deletingPlanId === plan.id,
      });
      return actions;
    },
    [
      deletingPlanId,
      handleStatusChange,
      isManaging,
      openEditDialog,
      updatingPlanId,
    ],
  );

  return (
    <div className="space-y-6">
      <ActionBar
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Логистика', href: '/logistics' },
              { label: 'Маршрутные листы' },
            ]}
          />
        }
        icon={TruckIcon}
        title="Маршрутные листы"
        description="Просматривайте маршрутные листы доставки без привязки к карте: задачи, назначенные водители и транспорт, статус и детали."
        filters={
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormGroup label="Поиск" htmlFor="logistics-search">
              <UnifiedSearch
                id="logistics-search"
                value={searchDraft}
                onChange={setSearchDraft}
                onSearch={applySearch}
                onReset={resetSearch}
                placeholder="Маршрутный лист, водитель, авто, задача"
                showActions
              />
            </FormGroup>
            <FormGroup label="Статус" htmlFor="logistics-status-filter">
              <Select
                id="logistics-status-filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as RoutePlanStatus | 'cancelled' | 'all',
                  )
                }
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormGroup>
          </div>
        }
        toolbar={
          <>
            <Button
              onClick={() => void loadPlans()}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              {loading ? 'Обновляем…' : 'Обновить'}
            </Button>
            {isManaging ? (
              <Button type="button" size="sm" onClick={openCreateDialog}>
                Создать маршрутный лист
              </Button>
            ) : null}
            <Button
              type="button"
              variant={viewMode === 'cards' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setViewMode('cards')}
              disabled={viewMode === 'cards'}
            >
              <Squares2X2Icon className="mr-1 h-4 w-4" />
              Карточки
            </Button>
            <Button
              type="button"
              variant={viewMode === 'table' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setViewMode('table')}
              disabled={viewMode === 'table'}
            >
              <TableCellsIcon className="mr-1 h-4 w-4" />
              Таблица
            </Button>
          </>
        }
      />
      {!isAdmin && !isManager && (
        <p className="text-sm text-muted-foreground">
          Управление маршрутными листами доступно администраторам и менеджерам.
          Остальные пользователи могут просматривать список.
        </p>
      )}
      {error && (
        <div
          className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}
      {loading ? (
        <SkeletonCard />
      ) : filteredPlans.length === 0 ? (
        <div className="ui-card text-sm text-muted-foreground">
          Маршрутные листы отсутствуют.
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredPlans.map((plan) => {
            const status = normalizeStatus(plan.status);
            const tasks = collectTasks(plan.routes ?? []);
            const drivers = collectDrivers(plan.routes ?? []);
            const vehicles = collectVehicles(plan.routes ?? []);
            const statusLabel = STATUS_LABELS[status] ?? status;

            return (
              <article
                key={plan.id}
                className="ui-card flex h-full flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Создан: {formatDate(plan.createdAt)}
                    </p>
                    <h3 className="text-lg font-semibold leading-6">
                      {plan.title}
                    </h3>
                  </div>
                  <StatusBadge
                    status={statusLabel}
                    tone={mapStatusTone(status)}
                    className="ml-auto"
                  />
                </div>
                {plan.notes && (
                  <p
                    className="text-sm text-foreground"
                    aria-label="Описание плана"
                  >
                    {plan.notes}
                  </p>
                )}
                <div className="space-y-1 text-sm text-foreground">
                  <p>
                    <span className="font-medium">Водитель: </span>
                    {drivers}
                  </p>
                  <p>
                    <span className="font-medium">Авто: </span>
                    {vehicles}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Задачи</p>
                  {tasks.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                      {tasks.map((task) => (
                        <li key={task}>{task}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Задачи не назначены
                    </p>
                  )}
                </div>
                {isManaging ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={plan.status}
                      onChange={(event) =>
                        void handleStatusChange(
                          plan.id,
                          event.target.value as RoutePlanStatus,
                        )
                      }
                      disabled={updatingPlanId === plan.id}
                      aria-label="Статус маршрутного листа"
                    >
                      {statusSelectOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(plan.id)}
                      disabled={deletingPlanId === plan.id}
                    >
                      Редактировать
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeletePlan(plan)}
                      disabled={deletingPlanId === plan.id}
                    >
                      Удалить
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <SimpleTable
          columns={columns}
          data={pagedPlans}
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageCount={pageCount}
          onPageChange={setPageIndex}
          showGlobalSearch={false}
          showFilters={false}
          rowHeight={64}
          getRowActions={isManaging ? rowActions : undefined}
        />
      )}
      <ConfirmDialog
        open={Boolean(deletePlan)}
        message={`Удалить маршрутный лист \"${deletePlan?.title ?? ''}\"?`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletePlan(null)}
        confirmText="Удалить"
        cancelText="Отмена"
      />
      <RoutePlanDialog
        open={dialogOpen}
        planId={dialogPlanId}
        onClose={closeDialog}
        onSaved={handleDialogSaved}
      />
    </div>
  );
}
