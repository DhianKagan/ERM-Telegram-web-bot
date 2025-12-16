import { type RoutePlanStatus, type RoutePlanAnalyticsSummary } from 'shared';
export interface RoutePlanAnalyticsFilters {
    from?: Date;
    to?: Date;
    status?: RoutePlanStatus;
}
export declare function fetchRoutePlanAnalytics(filters: RoutePlanAnalyticsFilters): Promise<RoutePlanAnalyticsSummary>;
