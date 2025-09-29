// Сервисные функции задач используют общие запросы к MongoDB
// Модули: db/queries, services/route, shared
import * as q from '../db/queries';
import type { TaskDocument } from '../db/model';
import { getRouteDistance, Point } from './route';
import { generateRouteLink, type Task } from 'shared';

export type TaskData = Partial<Omit<Task, 'completed_at'>> & {
  completed_at?: string | Date | null;
  startCoordinates?: Point;
  finishCoordinates?: Point;
  google_route_url?: string;
  route_distance_km?: number;
  due_date?: Date;
  remind_at?: Date;
  [key: string]: unknown;
};

const normalizeCompletedAt = (
  value: TaskData['completed_at'],
): Date | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const prepareTaskPayload = (
  input: TaskData = {},
): Partial<TaskDocument> => {
  const { completed_at, ...rest } = input;
  const payload: Partial<TaskDocument> = {
    ...(rest as Partial<TaskDocument>),
  };
  if (Object.prototype.hasOwnProperty.call(input, 'completed_at')) {
    payload.completed_at = normalizeCompletedAt(completed_at);
  }
  return payload;
};

async function applyRouteInfo(data: TaskData = {}): Promise<void> {
  if (data.startCoordinates && data.finishCoordinates) {
    data.google_route_url = generateRouteLink(
      data.startCoordinates,
      data.finishCoordinates,
    );
    try {
      const r = await getRouteDistance(
        data.startCoordinates,
        data.finishCoordinates,
      );
      data.route_distance_km = Number((r.distance! / 1000).toFixed(1));
    } catch {
      /* игнорируем ошибки маршрута */
    }
  }
}

export const create = async (
  data: TaskData = {},
  userId?: number,
): Promise<unknown> => {
  if (data.due_date && !data.remind_at) data.remind_at = data.due_date;
  await applyRouteInfo(data);
  const payload = prepareTaskPayload(data);
  return q.createTask(payload, userId);
};

export const get = (
  filters: Record<string, unknown>,
  page: number,
  limit: number,
): Promise<unknown> => q.getTasks(filters, page, limit);

export const getById = (id: string): Promise<unknown> => q.getTask(id);

export const update = async (
  id: string,
  data: TaskData = {},
  userId = 0,
): Promise<unknown> => {
  await applyRouteInfo(data);
  const payload = prepareTaskPayload(data);
  return q.updateTask(id, payload, userId);
};

export const addTime = (
  id: string,
  minutes: number,
  userId = 0,
): Promise<unknown> => q.addTime(id, minutes, userId);

export const bulk = (
  ids: string[],
  data: TaskData = {},
): Promise<unknown> => {
  const draft: TaskData = { ...(data ?? {}) };
  if (Object.prototype.hasOwnProperty.call(draft, 'status')) {
    const status = draft.status;
    const isCompleted = status === 'Выполнена' || status === 'Отменена';
    if (isCompleted) {
      if (!Object.prototype.hasOwnProperty.call(draft, 'completed_at')) {
        draft.completed_at = new Date();
      } else if (draft.completed_at === undefined) {
        draft.completed_at = new Date();
      }
    } else {
      draft.completed_at = null;
    }
  }
  const payload = prepareTaskPayload(draft);
  return q.bulkUpdate(ids, payload);
};

export const summary = (filters: Record<string, unknown>): Promise<unknown> =>
  q.summary(filters);

export const remove = (id: string): Promise<unknown> => q.deleteTask(id);

export const mentioned = (userId: number): Promise<unknown> =>
  q.listMentionedTasks(userId);
