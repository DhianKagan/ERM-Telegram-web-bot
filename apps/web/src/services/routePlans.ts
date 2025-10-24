// Назначение: HTTP-запросы для работы с маршрутными планами.
// Основные модули: authFetch, shared

import type { RoutePlan, RoutePlanStatus } from "shared";
import authFetch from "../utils/authFetch";

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
  if (status) params.set("status", status);
  if (limit) params.set("limit", String(limit));
  if (page) params.set("page", String(page));
  const response = await authFetch(`/api/v1/route-plans?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Не удалось загрузить маршрутные планы");
  }
  return (await response.json()) as RoutePlanListResponse;
}

export async function getRoutePlan(id: string): Promise<RoutePlan> {
  const response = await authFetch(`/api/v1/route-plans/${id}`);
  if (!response.ok) {
    throw new Error("Маршрутный план не найден");
  }
  const data = await response.json();
  return data.plan as RoutePlan;
}

export async function updateRoutePlan(
  id: string,
  payload: RoutePlanUpdatePayload,
): Promise<RoutePlan> {
  const response = await authFetch(`/api/v1/route-plans/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Не удалось сохранить маршрутный план");
  }
  const data = await response.json();
  return data.plan as RoutePlan;
}

export async function changeRoutePlanStatus(
  id: string,
  status: RoutePlanStatus,
): Promise<RoutePlan> {
  const response = await authFetch(`/api/v1/route-plans/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    throw new Error("Не удалось обновить статус маршрутного плана");
  }
  const data = await response.json();
  return data.plan as RoutePlan;
}

export async function deleteRoutePlan(id: string): Promise<void> {
  const response = await authFetch(`/api/v1/route-plans/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Не удалось удалить маршрутный план");
  }
}

export default {
  listRoutePlans,
  getRoutePlan,
  updateRoutePlan,
  changeRoutePlanStatus,
  deleteRoutePlan,
};
