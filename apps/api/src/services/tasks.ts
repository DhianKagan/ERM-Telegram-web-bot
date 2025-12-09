// apps/api/src/services/tasks.ts
// Сервисные функции задач используют общие запросы к MongoDB
// Модули: db/queries, services/route, shared
import * as q from '../db/queries';
import type { TaskDocument } from '../db/model';
import { generateRouteLink, type Task } from 'shared';
import { getOsrmDistance, type OsrmPoint } from '../geo/osrm';
import { resolveTaskTypeTopicId } from './taskTypeSettings';
import { ensureTaskLinksShort } from './taskLinks';
import { parsePointInput, LatLng } from '../utils/geo';
import { logger } from '../services/wgLogEngine';

export type TaskData = Partial<Omit<Task, 'completed_at'>> & {
  completed_at?: string | Date | null;
  startCoordinates?: OsrmPoint | string | null;
  finishCoordinates?: OsrmPoint | string | null;
  google_route_url?: string;
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
  const parsed = new Date(value);
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

const applyTaskTypeTopic = async (data: TaskData = {}): Promise<void> => {
  const type = typeof data.task_type === 'string' ? data.task_type.trim() : '';
  if (!type) {
    return;
  }
  const topicId = await resolveTaskTypeTopicId(type);
  if (typeof topicId === 'number') {
    data.telegram_topic_id = topicId;
  }
};

/**
 * Ensure startCoordinates/finishCoordinates are proper objects {lat,lng}
 * Accepts that input might be string/json or already object with various shapes.
 * Mutates data in place.
 */
function normalizeTaskCoordinates(data: TaskData): void {
  try {
    if (data.startCoordinates) {
      const parsed = parsePointInput(data.startCoordinates);
      if (parsed) {
        data.startCoordinates = parsed as unknown as OsrmPoint;
      } else {
        logger.warn({ val: data.startCoordinates }, 'normalizeTaskCoordinates: unable to parse startCoordinates');
        data.startCoordinates = undefined;
      }
    }
    if (data.finishCoordinates) {
      const parsed = parsePointInput(data.finishCoordinates);
      if (parsed) {
        data.finishCoordinates = parsed as unknown as OsrmPoint;
      } else {
        logger.warn({ val: data.finishCoordinates }, 'normalizeTaskCoordinates: unable to parse finishCoordinates');
        data.finishCoordinates = undefined;
      }
    }
  } catch (e) {
    logger.error({ err: e }, 'normalizeTaskCoordinates: unexpected error');
    // Don't throw — we want higher-level logic to handle missing coords
    data.startCoordinates = undefined;
    data.finishCoordinates = undefined;
  }
};

async function applyRouteInfo(data: TaskData = {}): Promise<void> {
  // Normalize coordinates before using
  normalizeTaskCoordinates(data);

  if (data.startCoordinates && data.finishCoordinates) {
    // ensure types
    const start = data.startCoordinates as unknown as LatLng;
    const finish = data.finishCoordinates as unknown as LatLng;
    data.google_route_url = generateRouteLink(start, finish);
    try {
      const distanceKm = await getOsrmDistance({
        start: data.startCoordinates as OsrmPoint,
        finish: data.finishCoordinates as OsrmPoint,
      });
      data.route_distance_km = distanceKm;
    } catch (e) {
      logger.warn({ err: e }, 'applyRouteInfo: getOsrmDistance failed');
      data.route_distance_km = null;
    }
  } else {
    // If coordinates missing, clear route fields
    data.google_route_url = data.google_route_url ?? undefined;
    data.route_distance_km = data.route_distance_km ?? null;
  }
}

// ... остальной код без изменений (create, update, etc.)

export const create = async (
  data: TaskData = {},
  userId?: number,
): Promise<unknown> => {
  if (data.due_date && !data.remind_at) data.remind_at = data.due_date;
  // normalize coords inside applyRouteInfo
  await applyRouteInfo(data);
  await ensureTaskLinksShort(data as Partial<TaskDocument>);
  await applyTaskTypeTopic(data);
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
  if (Object.prototype.hasOwnProperty.call(data, 'task_type')) {
    await applyTaskTypeTopic(data);
  }
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
