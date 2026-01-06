// Назначение: HTTP-запросы аналитики маршрутных планов.
// Основные модули: authFetch, shared

import type { UseQueryOptions } from '@tanstack/react-query';
import type { RoutePlanAnalyticsSummary, RoutePlanStatus } from 'shared';
import { useApiQuery } from '../hooks/useApiQuery';
import authFetch from '../utils/authFetch';

export interface RoutePlanAnalyticsParams {
  from?: string;
  to?: string;
  status?: RoutePlanStatus;
}

export const analyticsKeys = {
  routePlanSummary: (params: RoutePlanAnalyticsParams) =>
    ['analytics', 'route-plans', params] as const,
};

export async function fetchRoutePlanAnalytics(
  params: RoutePlanAnalyticsParams = {},
): Promise<RoutePlanAnalyticsSummary> {
  const search = new URLSearchParams();
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  if (params.status) search.set('status', params.status);
  const query = search.toString();
  const response = await authFetch(
    `/api/v1/analytics/route-plans/summary${query ? `?${query}` : ''}`,
  );
  if (!response.ok) {
    throw new Error('Не удалось получить аналитику маршрутных планов');
  }
  return (await response.json()) as RoutePlanAnalyticsSummary;
}

export const useRoutePlanAnalytics = (
  params: RoutePlanAnalyticsParams,
  options?: Omit<
    UseQueryOptions<
      RoutePlanAnalyticsSummary,
      Error,
      RoutePlanAnalyticsSummary,
      ReturnType<typeof analyticsKeys.routePlanSummary>
    >,
    'queryKey' | 'queryFn'
  >,
) => {
  const search = new URLSearchParams();
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  if (params.status) search.set('status', params.status);
  const query = search.toString();

  return useApiQuery<RoutePlanAnalyticsSummary>({
    queryKey: analyticsKeys.routePlanSummary(params),
    url: `/api/v1/analytics/route-plans/summary${query ? `?${query}` : ''}`,
    parse: async (response) => {
      if (!response.ok) {
        throw new Error('Не удалось получить аналитику маршрутных планов');
      }
      return (await response.json()) as RoutePlanAnalyticsSummary;
    },
    ...options,
  });
};

export default { fetchRoutePlanAnalytics };
