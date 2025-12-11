// apps/api/src/services/tasks.ts
import * as q from '../db/queries';
import type { TaskDocument } from '../db/model';
import { ensureTaskLinksShort } from './taskLinks';
import { parsePointInput } from '../utils/geo';
import { logger } from '../services/wgLogEngine';
import { syncTaskPoints } from '../utils/taskPoints';

/**
 * TaskData — частичный объект задачи. Используем TaskDocument для полей схемы.
 * startCoordinates/finishCoordinates остаются информационными (если присутствуют).
 */
export type TaskData = Partial<TaskDocument> & {
  completed_at?: string | Date | null;
  startCoordinates?: unknown;
  finishCoordinates?: unknown;
  points?: unknown;
  google_route_url?: string | null;
  route_distance_km?: number | null;
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
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const prepareTaskPayload = (input: TaskData = {}): Partial<TaskDocument> => {
  const { completed_at, ...rest } = input;
  const payload: Partial<TaskDocument> = {
    ...(rest as Partial<TaskDocument>),
  };
  if (Object.prototype.hasOwnProperty.call(input, 'completed_at')) {
    payload.completed_at = normalizeCompletedAt(completed_at);
  }
  return payload;
};

/**
 * Normalize coordinates fields in TaskData.
 * Coordinates are informational only — parsing is delegated to parsePointInput (shared.extractCoords).
 * If parsing fails, we clear the coordinate field (do not throw).
 */
function normalizeTaskCoordinates(data: TaskData): void {
  try {
    if (data.startCoordinates) {
      const parsed = parsePointInput(data.startCoordinates);
      if (parsed) {
        // keep normalized form
        data.startCoordinates = parsed as TaskDocument['startCoordinates'];
      } else {
        logger.warn(
          { val: data.startCoordinates },
          'normalizeTaskCoordinates: unable to parse startCoordinates',
        );
        data.startCoordinates = undefined;
      }
    }
    if (data.finishCoordinates) {
      const parsed = parsePointInput(data.finishCoordinates);
      if (parsed) {
        data.finishCoordinates = parsed as TaskDocument['finishCoordinates'];
      } else {
        logger.warn(
          { val: data.finishCoordinates },
          'normalizeTaskCoordinates: unable to parse finishCoordinates',
        );
        data.finishCoordinates = undefined;
      }
    }
  } catch (e) {
    logger.error({ err: e }, 'normalizeTaskCoordinates: unexpected error');
    data.startCoordinates = undefined;
    data.finishCoordinates = undefined;
  }
}

/**
 * applyRouteInfo — упрощено: не строим маршрут и не считаем расстояние.
 * Если координаты присутствуют — они сохраняются (как информация).
 * Поля route_distance_km и google_route_url сбрасываются.
 */
async function applyRouteInfo(data: TaskData = {}): Promise<void> {
  syncTaskPoints(data as Partial<TaskDocument>);
  normalizeTaskCoordinates(data);

  // intentionally do not calculate or set google_route_url / route_distance_km
  data.google_route_url = undefined;
  data.route_distance_km = null;
}

export const create = async (
  data: TaskData = {},
  userId?: number,
): Promise<unknown> => {
  if (data.due_date && !data.remind_at) data.remind_at = data.due_date;
  await applyRouteInfo(data);
  await ensureTaskLinksShort(data as Partial<TaskDocument>);
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
  await ensureTaskLinksShort(data as Partial<TaskDocument>);
  const payload = prepareTaskPayload(data);
  return q.updateTask(id, payload, userId);
};

export const addTime = (
  id: string,
  minutes: number,
  userId = 0,
): Promise<unknown> => q.addTime(id, minutes, userId);

export const bulk = async (
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
  await ensureTaskLinksShort(draft as Partial<TaskDocument>);
  const payload = prepareTaskPayload(draft);
  return q.bulkUpdate(ids, payload);
};

export const summary = (filters: Record<string, unknown>): Promise<unknown> =>
  q.summary(filters);
export const remove = (id: string): Promise<unknown> => q.deleteTask(id);
export const mentioned = (userId: number): Promise<unknown> =>
  q.listMentionedTasks(userId);
