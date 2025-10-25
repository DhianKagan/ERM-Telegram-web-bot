// Назначение: контроллер оптимизации маршрутов
// Основные модули: express-validator, services/optimizer
import { Response } from 'express';
import { validationResult } from 'express-validator';
import * as service from '../services/optimizer';
import { sendProblem } from '../utils/problem';
import type RequestWithUser from '../types/request';

type OptimizeTaskBody = {
  id?: unknown;
  coordinates?: unknown;
  demand?: unknown;
  serviceMinutes?: unknown;
  timeWindow?: unknown;
  title?: unknown;
  startAddress?: unknown;
  finishAddress?: unknown;
};

type OptimizeRequestBody = {
  tasks?: OptimizeTaskBody[];
  vehicleCapacity?: unknown;
  vehicleCount?: unknown;
  timeWindows?: unknown;
  averageSpeedKmph?: unknown;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const toPositiveInt = (value: unknown): number | undefined => {
  const numeric = toNumber(value);
  if (typeof numeric !== 'number') {
    return undefined;
  }
  const rounded = Math.floor(numeric);
  return rounded >= 1 ? rounded : undefined;
};

const toNonNegativeNumber = (value: unknown): number | undefined => {
  const numeric = toNumber(value);
  if (typeof numeric !== 'number') {
    return undefined;
  }
  return numeric >= 0 ? numeric : undefined;
};

const toCoordinate = (value: unknown): { lat: number; lng: number } | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const lat = toNumber(record.lat);
  const lng = toNumber(record.lng);
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return undefined;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return undefined;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return undefined;
  }
  return { lat, lng };
};

const toTimeWindow = (value: unknown): [number, number] | undefined => {
  if (!Array.isArray(value) || value.length !== 2) {
    return undefined;
  }
  const start = toNonNegativeNumber(value[0]);
  const end = toNonNegativeNumber(value[1]);
  if (typeof start !== 'number' || typeof end !== 'number') {
    return undefined;
  }
  if (end < start) {
    return undefined;
  }
  return [Math.floor(start), Math.floor(end)];
};

const normalizeTask = (task: OptimizeTaskBody): service.OptimizeTaskInput | null => {
  const id =
    typeof task.id === 'string'
      ? task.id.trim()
      : task.id != null
      ? String(task.id).trim()
      : '';
  if (!id) {
    return null;
  }
  const coordinates = toCoordinate(task.coordinates);
  if (!coordinates) {
    return null;
  }
  const demand = toNonNegativeNumber(task.demand);
  const serviceMinutes = toNonNegativeNumber(task.serviceMinutes);
  const timeWindow = toTimeWindow(task.timeWindow);
  const title = typeof task.title === 'string' ? task.title.trim() || undefined : undefined;
  const startAddress =
    typeof task.startAddress === 'string' ? task.startAddress.trim() || undefined : undefined;
  const finishAddress =
    typeof task.finishAddress === 'string' ? task.finishAddress.trim() || undefined : undefined;
  return {
    id,
    coordinates,
    demand,
    serviceMinutes,
    timeWindow,
    title,
    startAddress,
    finishAddress,
  };
};

const normalizeTasks = (value: OptimizeTaskBody[] | undefined): service.OptimizeTaskInput[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((task) => normalizeTask(task))
    .filter((task): task is service.OptimizeTaskInput => Boolean(task));
};

const normalizeTimeWindows = (value: unknown): Array<[number, number]> | undefined => {
  if (value == null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return undefined;
  }
  const windows: Array<[number, number]> = [];
  for (const item of value) {
    const normalized = toTimeWindow(item);
    if (!normalized) {
      return undefined;
    }
    windows.push(normalized);
  }
  return windows;
};

const normalizeSpeed = (value: unknown): number | undefined => {
  const numeric = toNumber(value);
  if (typeof numeric !== 'number') return undefined;
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return undefined;
  }
  return numeric;
};

export async function optimize(
  req: RequestWithUser<Record<string, string>, unknown, OptimizeRequestBody>,
  res: Response,
): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorList = errors.array();
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Ошибка валидации',
      status: 400,
      detail: 'Ошибка валидации',
      errors: errorList,
    });
    return;
  }
  const tasks = normalizeTasks(req.body?.tasks);
  const rawCapacity = toPositiveInt(req.body?.vehicleCapacity);
  const vehicleCapacity =
    typeof rawCapacity === 'number' ? rawCapacity : Math.max(1, tasks.length || 1);
  const vehicleCount = toPositiveInt(req.body?.vehicleCount) ?? 1;
  const timeWindows = normalizeTimeWindows(req.body?.timeWindows);
  const averageSpeedKmph = normalizeSpeed(req.body?.averageSpeedKmph);

  const result = await service.optimize(
    tasks,
    {
      vehicleCapacity,
      vehicleCount,
      timeWindows,
      averageSpeedKmph,
    },
  );
  res.json({ result });
}
