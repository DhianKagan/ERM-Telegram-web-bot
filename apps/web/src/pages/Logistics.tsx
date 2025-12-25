// Страница отображения маршрутных планов в виде карточек
// Основные модули: React, listRoutePlans, компоненты интерфейса
import React from 'react';
import type {
  RoutePlan,
  RoutePlanRoute,
  RoutePlanStatus,
  RoutePlanTaskRef,
} from 'shared';

import { Button } from '@/components/ui/button';
import StatusBadge, { mapStatusTone } from '@/components/ui/StatusBadge';
import { UiFormGroup } from '@/components/ui/UiFormGroup';
import { UiSelect } from '@/components/ui/UiSelect';
import Breadcrumbs from '../components/Breadcrumbs';
import SkeletonCard from '../components/SkeletonCard';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { listRoutePlans } from '../services/routePlans';
import { ACCESS_ADMIN, ACCESS_MANAGER, hasAccess } from '../utils/access';

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

export default function Logistics() {
  const [plans, setPlans] = React.useState<RoutePlan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<
    RoutePlanStatus | 'cancelled' | 'all'
  >('all');
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
          : 'Не удалось загрузить маршрутные планы';
      setError(message);
      addToast(message);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const filteredPlans = React.useMemo(() => {
    if (statusFilter === 'all') return plans;
    return plans.filter(
      (plan) => normalizeStatus(plan.status) === statusFilter,
    );
  }, [plans, statusFilter]);

  const access = typeof user?.access === 'number' ? user.access : 0;
  const isAdmin = user?.role === 'admin' || hasAccess(access, ACCESS_ADMIN);
  const isManager = hasAccess(access, ACCESS_MANAGER);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Логистика', href: '/logistics' },
          { label: 'Маршрутные планы' },
        ]}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Маршрутные планы</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Просматривайте планы доставки без привязки к карте: задачи,
            назначенные водители и транспорт, статус и детали плана.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <UiFormGroup
            label="Статус"
            htmlFor="logistics-status-filter"
            className="sm:w-48"
          >
            <UiSelect
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
            </UiSelect>
          </UiFormGroup>
          <Button
            onClick={() => void loadPlans()}
            disabled={loading}
            variant="secondary"
            size="sm"
            className="sm:self-end"
          >
            {loading ? 'Обновляем…' : 'Обновить'}
          </Button>
        </div>
      </div>
      {!isAdmin && !isManager && (
        <p className="text-sm text-muted-foreground">
          Управление маршрутными планами доступно администраторам и менеджерам.
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
          Маршрутные планы отсутствуют.
        </div>
      ) : (
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
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
