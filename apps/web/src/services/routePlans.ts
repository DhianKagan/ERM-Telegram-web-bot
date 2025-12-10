// Назначение: HTTP-запросы для работы с маршрутными планами.
// Основные модули: authFetch, shared

import type { RoutePlan, RoutePlanRoute, RoutePlanStatus } from 'shared';
import authFetch from '../utils/authFetch';

const normalizeRoutes = (routes?: RoutePlanRoute[]): RoutePlanRoute[] => {
  if (!Array.isArray(routes)) return [];
  return routes.map((route) => ({
    ...route,
    tasks: Array.isArray(route.tasks) ? route.tasks : [],
    stops: Array.isArray(route.stops) ? route.stops : [],
    metrics: route.metrics ?? {},
  }));
};

const normalizePlan = (plan: RoutePlan): RoutePlan => {
  const routes = normalizeRoutes(plan.routes);
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const totalStops = routes.reduce(
    (sum, route) => sum + (route.stops?.length ?? 0),
    0,
  );
  const totalTasks =
    plan.metrics?.totalTasks ??
    (tasks.length ||
      routes.reduce((sum, route) => sum + route.tasks.length, 0));

  return {
    ...plan,
    routes,
    tasks,
    metrics: plan.metrics ?? {
      totalDistanceKm: null,
      totalRoutes: routes.length,
      totalTasks,
      totalStops,
      totalEtaMinutes: null,
      totalLoad: null,
    },
  };
};

type RoutePlanListResponsePayload = {
  items?: RoutePlan[];
  total?: number;
};

export interface RoutePlanUpdatePayload {
  title?: string;
  notes?: string | null;
  routes?: Array<{
    id?: string;
    order?: number;
    vehicleId?: string | null;
    vehicleName?: string | null;
    driverId?: number | string | null;
    driverName?: string | null;
    notes?: string | null;
    tasks: string[];
  }>;
}

export interface RoutePlanListResponse {
  items: RoutePlan[];
  total: number;
}

export async function listRoutePlans(
  status?: RoutePlanStatus,
  limit?: number,
  page?: number,
): Promise<RoutePlanListResponse> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (limit) params.set('limit', String(limit));
  if (page) params.set('page', String(page));
  const response = await authFetch(`/api/v1/route-plans?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Не удалось загрузить маршрутные планы');
  }
  const payload = (await response.json()) as RoutePlanListResponsePayload;
  const items = Array.isArray(payload.items)
    ? payload.items.map(normalizePlan)
    : [];
  const total =
    typeof payload.total === 'number' ? payload.total : items.length;
  return { items, total };
}

export async function getRoutePlan(id: string): Promise<RoutePlan> {
  const response = await authFetch(`/api/v1/route-plans/${id}`);
  if (!response.ok) {
    throw new Error('Маршрутный план не найден');
  }
  const data = await response.json();
  return normalizePlan(data.plan as RoutePlan);
}

export async function updateRoutePlan(
  id: string,
  payload: RoutePlanUpdatePayload,
): Promise<RoutePlan> {
  const response = await authFetch(`/api/v1/route-plans/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('Не удалось сохранить маршрутный план');
  }
  const data = await response.json();
  return normalizePlan(data.plan as RoutePlan);
}

export async function changeRoutePlanStatus(
  id: string,
  status: RoutePlanStatus,
): Promise<RoutePlan> {
  const response = await authFetch(`/api/v1/route-plans/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    throw new Error('Не удалось обновить статус маршрутного плана');
  }
  const data = await response.json();
  return normalizePlan(data.plan as RoutePlan);
}

export async function deleteRoutePlan(id: string): Promise<void> {
  const response = await authFetch(`/api/v1/route-plans/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Не удалось удалить маршрутный план');
  }
}

export default {
  listRoutePlans,
  getRoutePlan,
  updateRoutePlan,
  changeRoutePlanStatus,
  deleteRoutePlan,
};
