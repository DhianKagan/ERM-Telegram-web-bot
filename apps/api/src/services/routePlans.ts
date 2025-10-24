// Назначение: сервис управления маршрутными планами и уведомлениями.
// Основные модули: mongoose, shared, db/models/routePlan, telegramApi, db/queries

import { Types } from 'mongoose';
import {
  PROJECT_TIMEZONE,
  generateMultiRouteLink,
  type RoutePlan as SharedRoutePlan,
  type RoutePlanRoute as SharedRoutePlanRoute,
  type RoutePlanStatus,
} from 'shared';
import {
  RoutePlan as RoutePlanModel,
  type RoutePlanDocument,
  type RoutePlanRouteEntry,
} from '../db/models/routePlan';
import { Task } from '../db/model';
import { chatId } from '../config';
import { call as telegramCall } from './telegramApi';
import { getUser } from '../db/queries';

const TITLE_MAX_LENGTH = 120;
const NOTES_MAX_LENGTH = 1024;
const VEHICLE_NAME_MAX_LENGTH = 80;
const DRIVER_NAME_MAX_LENGTH = 80;
const ADDRESS_MAX_LENGTH = 200;

interface TaskSource {
  _id: Types.ObjectId | string;
  title?: string;
  startCoordinates?: { lat?: number; lng?: number } | null;
  finishCoordinates?: { lat?: number; lng?: number } | null;
  start_location?: string | null;
  end_location?: string | null;
  route_distance_km?: number | null;
}

export interface RoutePlanRouteInput {
  id?: string;
  order?: number;
  vehicleId?: string | null;
  vehicleName?: string | null;
  driverId?: number | string | null;
  driverName?: string | null;
  notes?: string | null;
  tasks: string[];
}

export interface RoutePlanUpdatePayload {
  title?: string;
  notes?: string | null;
  routes?: RoutePlanRouteInput[];
}

export interface RoutePlanListFilters {
  status?: RoutePlanStatus;
  page?: number;
  limit?: number;
}

export interface CreateRoutePlanOptions {
  actorId?: number;
  method?: 'angle' | 'trip';
  count?: number;
  title?: string;
  notes?: string | null;
}

type TaskMap = Map<string, TaskSource>;

type BuildResult = {
  routes: RoutePlanRouteEntry[];
  metrics: {
    totalDistanceKm?: number | null;
    totalRoutes: number;
    totalTasks: number;
    totalStops: number;
  };
  taskIds: Types.ObjectId[];
};

const statusTransitions: Record<RoutePlanStatus, RoutePlanStatus[]> = {
  draft: ['approved'],
  approved: ['draft', 'completed'],
  completed: [],
};

const roundDistance = (value: number | null | undefined): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Number(value.toFixed(1));
};

const normalizeString = (value: unknown, limit: number): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > limit) {
    return trimmed.slice(0, limit);
  }
  return trimmed;
};

const parseNumeric = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const parseObjectId = (value: unknown): Types.ObjectId | null => {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!Types.ObjectId.isValid(trimmed)) return null;
    return new Types.ObjectId(trimmed);
  }
  if (typeof value === 'object' && 'toString' in value) {
    return parseObjectId((value as { toString(): string }).toString());
  }
  return null;
};

const normalizeId = (value: unknown): string | null => {
  if (!value) return null;
  if (value instanceof Types.ObjectId) {
    return value.toHexString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (Types.ObjectId.isValid(trimmed)) {
      return new Types.ObjectId(trimmed).toHexString();
    }
    return trimmed;
  }
  if (typeof value === 'object' && 'toString' in value) {
    return normalizeId((value as { toString(): string }).toString());
  }
  return null;
};

const cloneCoords = (
  source: { lat?: number | null; lng?: number | null } | null | undefined,
): { lat: number; lng: number } | undefined => {
  if (!source || typeof source !== 'object') return undefined;
  const lat = typeof source.lat === 'number' ? source.lat : Number(source.lat);
  const lng = typeof source.lng === 'number' ? source.lng : Number(source.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return undefined;
  }
  return { lat, lng };
};

const ensureTaskMap = async (
  inputs: RoutePlanRouteInput[],
  map?: TaskMap,
): Promise<TaskMap> => {
  const taskMap = new Map<string, TaskSource>();
  if (map) {
    for (const [key, value] of map.entries()) {
      const normalizedKey = normalizeId(key);
      if (normalizedKey) {
        taskMap.set(normalizedKey, value);
      }
    }
  }
  const missing = new Set<string>();
  for (const route of inputs) {
    const tasks = Array.isArray(route.tasks) ? route.tasks : [];
    for (const id of tasks) {
      const normalized = normalizeId(id);
      if (!normalized) continue;
      if (!taskMap.has(normalized)) {
        missing.add(normalized);
      }
    }
  }
  if (!missing.size) {
    return taskMap;
  }
  const docs = await Task.find({ _id: { $in: Array.from(missing) } })
    .select(
      'title startCoordinates finishCoordinates start_location end_location route_distance_km',
    )
    .lean<TaskSource[]>();
  for (const doc of docs) {
    const key = normalizeId(doc._id);
    if (key) {
      taskMap.set(key, doc);
    }
  }
  return taskMap;
};

const sanitizeAddress = (value: unknown): string | null =>
  normalizeString(value, ADDRESS_MAX_LENGTH);

const defaultTitle = (): string => {
  try {
    const formatter = new Intl.DateTimeFormat('ru-UA', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: PROJECT_TIMEZONE,
    });
    return `Маршрутный план ${formatter.format(new Date())}`;
  } catch {
    return `Маршрутный план ${new Date().toISOString()}`;
  }
};

async function buildRoutesFromInput(
  routesInput: RoutePlanRouteInput[] = [],
  taskMap?: TaskMap,
): Promise<BuildResult> {
  const normalizedInputs = routesInput
    .map((route, idx) => {
      const tasks = Array.isArray(route.tasks)
        ? route.tasks.map((id) => normalizeId(id)).filter((id): id is string => Boolean(id))
        : [];
      return {
        id: typeof route.id === 'string' && route.id.trim() ? route.id.trim() : undefined,
        order: Number.isFinite(route.order) ? Number(route.order) : idx,
        vehicleId: parseObjectId(route.vehicleId),
        vehicleName: normalizeString(route.vehicleName, VEHICLE_NAME_MAX_LENGTH),
        driverId: parseNumeric(route.driverId),
        driverName: normalizeString(route.driverName, DRIVER_NAME_MAX_LENGTH),
        notes: normalizeString(route.notes, NOTES_MAX_LENGTH),
        tasks,
      };
    })
    .filter((route) => route.tasks.length);

  const map = await ensureTaskMap(routesInput, taskMap);
  const routes: RoutePlanRouteEntry[] = [];
  const uniqueTaskIds = new Map<string, Types.ObjectId>();
  let totalDistance = 0;
  let totalStops = 0;
  let totalTasks = 0;

  for (const route of normalizedInputs) {
    const routeTasks: RoutePlanRouteEntry['tasks'] = [];
    const stops: RoutePlanRouteEntry['stops'] = [];
    const coordsForLink: { lat: number; lng: number }[] = [];
    let routeDistance = 0;

    for (const taskId of route.tasks) {
      const task = map.get(taskId);
      if (!task) continue;
      const objectId = parseObjectId(task._id);
      if (!objectId) continue;
      uniqueTaskIds.set(objectId.toHexString(), objectId);

      const start = cloneCoords(task.startCoordinates ?? null);
      const finish = cloneCoords(task.finishCoordinates ?? null);
      const distanceKm = roundDistance(task.route_distance_km ?? undefined);

      const taskEntry = {
        taskId: objectId,
        order: routeTasks.length,
        title: typeof task.title === 'string' ? task.title : undefined,
        start: start ? { ...start } : undefined,
        finish: finish ? { ...finish } : undefined,
        startAddress: sanitizeAddress(task.start_location),
        finishAddress: sanitizeAddress(task.end_location),
        distanceKm,
      };
      routeTasks.push(taskEntry);

      if (start) {
        stops.push({
          order: stops.length,
          kind: 'start',
          taskId: objectId,
          coordinates: { ...start },
          address: sanitizeAddress(task.start_location),
        });
        coordsForLink.push(start);
      }
      if (finish) {
        stops.push({
          order: stops.length,
          kind: 'finish',
          taskId: objectId,
          coordinates: { ...finish },
          address: sanitizeAddress(task.end_location),
        });
        coordsForLink.push(finish);
      }
      if (typeof distanceKm === 'number') {
        routeDistance += distanceKm;
      }
    }

    if (!routeTasks.length) {
      continue;
    }

    const metrics = {
      distanceKm: roundDistance(routeDistance),
      tasks: routeTasks.length,
      stops: stops.length,
    };
    totalDistance += metrics.distanceKm ?? 0;
    totalStops += metrics.stops ?? 0;
    totalTasks += metrics.tasks ?? 0;

    const sortedStops = stops
      .map((stop, index) => ({ ...stop, order: Number.isFinite(stop.order) ? stop.order : index }))
      .sort((a, b) => a.order - b.order)
      .map((stop, index) => ({ ...stop, order: index }));
    const sortedTasks = routeTasks
      .map((task, index) => ({ ...task, order: Number.isFinite(task.order) ? task.order : index }))
      .sort((a, b) => a.order - b.order)
      .map((task, index) => ({ ...task, order: index }));

    const link = coordsForLink.length >= 2 ? generateMultiRouteLink(coordsForLink) : '';

    routes.push({
      id: route.id ?? new Types.ObjectId().toHexString(),
      order: Number.isFinite(route.order) ? route.order : routes.length,
      vehicleId: route.vehicleId ?? undefined,
      vehicleName: route.vehicleName ?? undefined,
      driverId: route.driverId ?? undefined,
      driverName: route.driverName ?? undefined,
      notes: route.notes ?? undefined,
      tasks: sortedTasks,
      stops: sortedStops,
      metrics,
      routeLink: link,
    });
  }

  const sortedRoutes = routes
    .map((route, index) => ({ ...route, order: Number.isFinite(route.order) ? route.order : index }))
    .sort((a, b) => a.order - b.order)
    .map((route, index) => ({ ...route, order: index }));

  return {
    routes: sortedRoutes,
    metrics: {
      totalDistanceKm: roundDistance(totalDistance),
      totalRoutes: sortedRoutes.length,
      totalTasks,
      totalStops,
    },
    taskIds: Array.from(uniqueTaskIds.values()),
  };
}

const serializeRoute = (route: RoutePlanRouteEntry): SharedRoutePlanRoute => {
  const vehicleId = parseObjectId(route.vehicleId);
  const tasks = (route.tasks || [])
    .map((task) => ({
      taskId: parseObjectId(task.taskId) ?? undefined,
      order: Number.isFinite(task.order) ? Number(task.order) : 0,
      title: typeof task.title === 'string' ? task.title : undefined,
      start: cloneCoords(task.start ?? null),
      finish: cloneCoords(task.finish ?? null),
      startAddress: sanitizeAddress(task.startAddress),
      finishAddress: sanitizeAddress(task.finishAddress),
      distanceKm: typeof task.distanceKm === 'number' ? Number(task.distanceKm) : null,
    }))
    .filter((task) => task.taskId)
    .sort((a, b) => a.order - b.order)
    .map((task, index) => ({
      taskId: (task.taskId as Types.ObjectId).toHexString(),
      order: index,
      title: task.title,
      start: task.start,
      finish: task.finish,
      startAddress: task.startAddress,
      finishAddress: task.finishAddress,
      distanceKm: task.distanceKm,
    }));

  const stops = (route.stops || [])
    .map((stop) => ({
      order: Number.isFinite(stop.order) ? Number(stop.order) : 0,
      kind: stop.kind === 'finish' ? 'finish' : 'start',
      taskId: parseObjectId(stop.taskId) ?? undefined,
      coordinates: cloneCoords(stop.coordinates ?? null),
      address: sanitizeAddress(stop.address),
    }))
    .filter((stop) => stop.taskId)
    .sort((a, b) => a.order - b.order)
    .map((stop, index) => ({
      order: index,
      kind: stop.kind,
      taskId: (stop.taskId as Types.ObjectId).toHexString(),
      coordinates: stop.coordinates,
      address: stop.address,
    }));

  const metrics = {
    distanceKm:
      route.metrics && typeof route.metrics.distanceKm === 'number'
        ? Number(route.metrics.distanceKm)
        : null,
    tasks: route.metrics?.tasks ?? tasks.length,
    stops: route.metrics?.stops ?? stops.length,
  };

  return {
    id: typeof route.id === 'string' && route.id ? route.id : new Types.ObjectId().toHexString(),
    order: Number.isFinite(route.order) ? Number(route.order) : 0,
    vehicleId: vehicleId ? vehicleId.toHexString() : null,
    vehicleName: route.vehicleName ?? null,
    driverId: typeof route.driverId === 'number' ? Number(route.driverId) : null,
    driverName: route.driverName ?? null,
    notes: route.notes ?? null,
    tasks,
    stops,
    metrics,
    routeLink: route.routeLink || null,
  };
};

const serializePlan = (plan: RoutePlanDocument): SharedRoutePlan => {
  const raw = plan.toObject({ depopulate: true, versionKey: false }) as {
    _id: Types.ObjectId | string;
    title?: string;
    status: RoutePlanStatus;
    suggestedBy?: number;
    method?: 'angle' | 'trip';
    count?: number;
    notes?: string;
    approvedBy?: number;
    routes?: RoutePlanRouteEntry[];
    metrics?: {
      totalDistanceKm?: number | null;
      totalRoutes?: number;
      totalTasks?: number;
      totalStops?: number;
    };
    tasks?: Array<Types.ObjectId | string>;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    approvedAt?: Date | string;
    completedAt?: Date | string;
  };

  const {
    title,
    status,
    suggestedBy,
    method,
    count,
    notes,
    approvedBy,
    routes: rawRoutes,
    metrics: rawMetrics,
    tasks: rawTasks,
    createdAt,
    updatedAt,
    approvedAt,
    completedAt,
    completedBy,
  } = raw;

  const routes = Array.isArray(rawRoutes)
    ? rawRoutes.map((route) => serializeRoute(route))
    : [];
  const sortedRoutes = routes
    .map((route, index) => ({ ...route, order: Number.isFinite(route.order) ? route.order : index }))
    .sort((a, b) => a.order - b.order)
    .map((route, index) => ({ ...route, order: index }));

  const totalDistance =
    typeof rawMetrics?.totalDistanceKm === 'number'
      ? Number(rawMetrics.totalDistanceKm)
      : sortedRoutes.reduce(
          (sum, route) => sum + (Number.isFinite(route.metrics?.distanceKm) ? Number(route.metrics?.distanceKm) : 0),
          0,
        );
  const totalTasks =
    typeof rawMetrics?.totalTasks === 'number'
      ? Number(rawMetrics.totalTasks)
      : sortedRoutes.reduce((sum, route) => sum + route.tasks.length, 0);
  const totalStops =
    typeof rawMetrics?.totalStops === 'number'
      ? Number(rawMetrics.totalStops)
      : sortedRoutes.reduce((sum, route) => sum + route.stops.length, 0);

  const taskIds = Array.isArray(rawTasks)
    ? rawTasks
        .map((id) => normalizeId(id))
        .filter((id): id is string => Boolean(id))
    : [];

  const toIso = (value: Date | string | undefined): string | undefined => {
    if (!value) return undefined;
    if (value instanceof Date) {
      return value.toISOString();
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  };

  const approvedAtIso = approvedAt ? toIso(approvedAt) ?? null : null;
  const completedAtIso = completedAt ? toIso(completedAt) ?? null : null;

  return {
    id: plan._id instanceof Types.ObjectId ? plan._id.toHexString() : String(plan._id),
    title: typeof title === 'string' ? title : '',
    status,
    suggestedBy:
      typeof suggestedBy === 'number' && Number.isFinite(suggestedBy) ? Number(suggestedBy) : null,
    method,
    count: typeof count === 'number' && Number.isFinite(count) ? Number(count) : undefined,
    notes: typeof notes === 'string' ? normalizeString(notes, NOTES_MAX_LENGTH) : null,
    approvedBy:
      typeof approvedBy === 'number' && Number.isFinite(approvedBy) ? Number(approvedBy) : null,
    approvedAt: approvedAtIso,
    completedBy:
      typeof completedBy === 'number' && Number.isFinite(completedBy)
        ? Number(completedBy)
        : null,
    completedAt: completedAtIso,
    metrics: {
      totalDistanceKm: roundDistance(totalDistance),
      totalRoutes: sortedRoutes.length,
      totalTasks,
      totalStops,
    },
    routes: sortedRoutes,
    tasks: taskIds,
    createdAt: toIso(createdAt),
    updatedAt: toIso(updatedAt),
  };
};

export async function createDraftFromInputs(
  routes: RoutePlanRouteInput[],
  options: CreateRoutePlanOptions = {},
  taskHints?: Iterable<TaskSource>,
): Promise<SharedRoutePlan> {
  let hintMap: TaskMap | undefined;
  if (taskHints) {
    hintMap = new Map<string, TaskSource>();
    for (const hint of taskHints) {
      const key = normalizeId(hint._id);
      if (key) {
        hintMap.set(key, hint);
      }
    }
  }

  const { routes: builtRoutes, metrics, taskIds } = await buildRoutesFromInput(routes, hintMap);
  const title = normalizeString(options.title, TITLE_MAX_LENGTH) ?? defaultTitle();
  const notes = normalizeString(options.notes, NOTES_MAX_LENGTH);
  const plan = await RoutePlanModel.create({
    title,
    status: 'draft',
    suggestedBy:
      typeof options.actorId === 'number' && Number.isFinite(options.actorId)
        ? Number(options.actorId)
        : undefined,
    method: options.method,
    count: options.count,
    notes,
    routes: builtRoutes,
    metrics,
    tasks: taskIds,
  });
  return serializePlan(plan);
}

export async function listPlans(
  filters: RoutePlanListFilters = {},
): Promise<{ items: SharedRoutePlan[]; total: number }> {
  const query: Record<string, unknown> = {};
  if (filters.status) {
    query.status = filters.status;
  }
  const total = await RoutePlanModel.countDocuments(query);
  let builder = RoutePlanModel.find(query).sort({ createdAt: -1 });
  const limit = Number(filters.limit);
  const page = Number(filters.page);
  if (Number.isFinite(limit) && limit > 0) {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const safePage = Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1;
    builder = builder.skip((safePage - 1) * safeLimit).limit(safeLimit);
  }
  const docs = await builder.exec();
  return {
    items: docs.map((doc) => serializePlan(doc)),
    total,
  };
}

export async function getPlan(id: string): Promise<SharedRoutePlan | null> {
  const objectId = parseObjectId(id);
  if (!objectId) return null;
  const plan = await RoutePlanModel.findById(objectId);
  return plan ? serializePlan(plan) : null;
}

export async function updatePlan(
  id: string,
  payload: RoutePlanUpdatePayload,
): Promise<SharedRoutePlan | null> {
  const objectId = parseObjectId(id);
  if (!objectId) return null;
  const plan = await RoutePlanModel.findById(objectId);
  if (!plan) return null;

  if (typeof payload.title === 'string') {
    const nextTitle = normalizeString(payload.title, TITLE_MAX_LENGTH);
    if (nextTitle) {
      plan.title = nextTitle;
    }
  }

  if (payload.notes === null || typeof payload.notes === 'string') {
    plan.notes = normalizeString(payload.notes, NOTES_MAX_LENGTH) ?? undefined;
  }

  if (Array.isArray(payload.routes)) {
    const { routes, metrics, taskIds } = await buildRoutesFromInput(payload.routes);
    plan.routes = routes;
    plan.metrics = metrics;
    plan.tasks = taskIds;
  }

  await plan.save();
  return serializePlan(plan);
}

const updateTasksForStatus = async (
  taskIds: Types.ObjectId[],
  status: RoutePlanStatus,
): Promise<void> => {
  if (!Array.isArray(taskIds) || !taskIds.length) return;
  const ids = taskIds.filter((id): id is Types.ObjectId => id instanceof Types.ObjectId);
  if (!ids.length) return;
  if (status === 'approved') {
    await Task.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status: 'В работе',
          in_progress_at: new Date(),
        },
      },
    );
  } else if (status === 'completed') {
    await Task.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status: 'Выполнена',
          completed_at: new Date(),
        },
      },
    );
  }
};

const canTransition = (from: RoutePlanStatus, to: RoutePlanStatus): boolean => {
  const allowed = statusTransitions[from] || [];
  return allowed.includes(to);
};

const notifyPlanApproved = async (
  plan: SharedRoutePlan,
  actorId?: number | null,
): Promise<void> => {
  if (!chatId) return;
  const actor =
    typeof actorId === 'number' && Number.isFinite(actorId) ? await getUser(actorId) : null;
  const actorName = actor?.name || actor?.username || (actorId ? `ID ${actorId}` : 'неизвестно');
  const lines: string[] = [
    `Маршрутный план "${plan.title}" утверждён диспетчером ${actorName}.`,
  ];
  plan.routes.forEach((route, routeIndex) => {
    const parts: string[] = [];
    const vehicle = route.vehicleName || (route.vehicleId ? `ID ${route.vehicleId}` : 'без транспорта');
    parts.push(`Маршрут ${routeIndex + 1} (${vehicle}`);
    if (route.driverName) {
      parts.push(`, водитель: ${route.driverName}`);
    }
    parts.push('):');
    lines.push(parts.join(''));
    route.tasks.forEach((task, taskIndex) => {
      const title = task.title || `Задача ${task.taskId}`;
      const distance =
        typeof task.distanceKm === 'number' && Number.isFinite(task.distanceKm)
          ? ` — ${task.distanceKm.toFixed(1)} км`
          : '';
      lines.push(`${taskIndex + 1}. ${title}${distance}`);
    });
    if (route.metrics?.distanceKm && Number.isFinite(route.metrics.distanceKm)) {
      lines.push(`Пробег: ${route.metrics.distanceKm.toFixed(1)} км.`);
    }
    if (route.routeLink) {
      lines.push(route.routeLink);
    }
  });
  const summary: string[] = [
    `Всего задач: ${plan.metrics.totalTasks}`,
    `маршрутов: ${plan.metrics.totalRoutes}`,
  ];
  if (plan.metrics.totalDistanceKm && Number.isFinite(plan.metrics.totalDistanceKm)) {
    summary.push(`расстояние: ${plan.metrics.totalDistanceKm.toFixed(1)} км`);
  }
  lines.push(summary.join(', '));
  try {
    await telegramCall('sendMessage', {
      chat_id: chatId,
      text: lines.join('\n'),
    });
  } catch (error) {
    console.error('Не удалось отправить уведомление о маршрутном плане', error);
  }
};

export async function updatePlanStatus(
  id: string,
  status: RoutePlanStatus,
  actorId?: number,
): Promise<SharedRoutePlan | null> {
  const objectId = parseObjectId(id);
  if (!objectId) return null;
  const plan = await RoutePlanModel.findById(objectId);
  if (!plan) return null;
  const current = plan.status as RoutePlanStatus;
  if (status === current) {
    return serializePlan(plan);
  }
  if (!canTransition(current, status)) {
    throw new Error('Недопустимый переход статуса маршрутного плана');
  }
  const now = new Date();
  if (status === 'draft') {
    plan.status = 'draft';
    plan.approvedAt = undefined;
    plan.approvedBy = undefined;
    plan.completedAt = undefined;
    plan.completedBy = undefined;
  } else if (status === 'approved') {
    plan.status = 'approved';
    plan.approvedAt = now;
    if (typeof actorId === 'number' && Number.isFinite(actorId)) {
      plan.approvedBy = actorId;
    }
  } else if (status === 'completed') {
    plan.status = 'completed';
    plan.completedAt = now;
    if (typeof actorId === 'number' && Number.isFinite(actorId)) {
      plan.completedBy = actorId;
      if (!plan.approvedBy) {
        plan.approvedBy = actorId;
      }
    }
    if (!plan.approvedAt) {
      plan.approvedAt = now;
    }
  }

  await plan.save();
  await updateTasksForStatus(plan.tasks as Types.ObjectId[], status);
  const serialized = serializePlan(plan);
  if (status === 'approved') {
    await notifyPlanApproved(serialized, actorId).catch(() => undefined);
  }
  return serialized;
}

export async function removePlan(id: string): Promise<boolean> {
  const objectId = parseObjectId(id);
  if (!objectId) return false;
  const res = await RoutePlanModel.findByIdAndDelete(objectId);
  return Boolean(res);
}

export type RoutePlanTaskHint = TaskSource;

export default {
  createDraftFromInputs,
  listPlans,
  getPlan,
  updatePlan,
  updatePlanStatus,
  removePlan,
};
