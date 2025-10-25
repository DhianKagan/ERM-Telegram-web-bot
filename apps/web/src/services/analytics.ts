// Назначение: HTTP-запросы аналитики маршрутных планов.
// Основные модули: authFetch, shared

import type {
  RoutePlanAnalyticsSummary,
  RoutePlanStatus,
} from "shared";
import authFetch from "../utils/authFetch";

export interface RoutePlanAnalyticsParams {
  from?: string;
  to?: string;
  status?: RoutePlanStatus;
}

export async function fetchRoutePlanAnalytics(
  params: RoutePlanAnalyticsParams = {},
): Promise<RoutePlanAnalyticsSummary> {
  const search = new URLSearchParams();
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.status) search.set("status", params.status);
  const query = search.toString();
  const response = await authFetch(
    `/api/v1/analytics/route-plans/summary${query ? `?${query}` : ""}`,
  );
  if (!response.ok) {
    throw new Error("Не удалось получить аналитику маршрутных планов");
  }
  return (await response.json()) as RoutePlanAnalyticsSummary;
}

export default { fetchRoutePlanAnalytics };
