// Сервисные функции задач используют общие запросы к MongoDB
// Модули: db/queries, services/route, services/maps
import * as q from '../db/queries';
import { getRouteDistance, Point } from './route';
import { generateRouteLink } from './maps';

export interface TaskData {
  startCoordinates?: Point;
  finishCoordinates?: Point;
  google_route_url?: string;
  route_distance_km?: number;
  due_date?: Date;
  remind_at?: Date;
  [key: string]: unknown;
}

async function applyRouteInfo(data: TaskData): Promise<void> {
  if (data.startCoordinates && data.finishCoordinates) {
    data.google_route_url = generateRouteLink(
      data.startCoordinates,
      data.finishCoordinates,
    );
    try {
      const r = await getRouteDistance(data.startCoordinates, data.finishCoordinates);
      data.route_distance_km = Number((r.distance! / 1000).toFixed(1));
    } catch {
      /* игнорируем ошибки маршрута */
    }
  }
}

export const create = async (data: TaskData): Promise<unknown> => {
  if (data.due_date && !data.remind_at) data.remind_at = data.due_date;
  await applyRouteInfo(data);
  return q.createTask(data);
};

export const get = (
  filters: Record<string, unknown>,
  page: number,
  limit: number,
): Promise<unknown> => q.getTasks(filters, page, limit);

export const getById = (id: string): Promise<unknown> => q.getTask(id);

export const update = async (id: string, data: TaskData): Promise<unknown> => {
  await applyRouteInfo(data);
  return q.updateTask(id, data);
};

export const addTime = (id: string, minutes: number): Promise<unknown> =>
  q.addTime(id, minutes);

export const bulk = (ids: string[], data: TaskData): Promise<unknown> =>
  q.bulkUpdate(ids, data);

export const summary = (filters: Record<string, unknown>): Promise<unknown> =>
  q.summary(filters);

export const remove = (id: string): Promise<unknown> => q.deleteTask(id);

export const mentioned = (userId: number): Promise<unknown> =>
  q.listMentionedTasks(userId);

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(module as any).exports = {
  create,
  get,
  getById,
  update,
  addTime,
  bulk,
  remove,
  summary,
  mentioned,
};

