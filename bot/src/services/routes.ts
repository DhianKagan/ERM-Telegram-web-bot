// Сервис получения маршрутов из MongoDB
// Модули: db/queries
import * as q from '../db/queries';

export interface RoutesFilter {
  [key: string]: unknown;
}

export function list(filters: RoutesFilter): Promise<unknown> {
  return q.listRoutes(filters);
}

