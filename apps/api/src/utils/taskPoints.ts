// apps/api/src/utils/taskPoints.ts
// Назначение: нормализация точек маршрута задачи и синхронизация со старыми полями координат.
// Основные модули: utils/geo, db/model
import type { TaskDocument, TaskPoint } from '../db/model';
import { parsePointInput, type LatLng } from './geo';

type PointKind = TaskPoint['kind'];

type TaskPointTarget = Partial<TaskDocument> & {
  points?: unknown;
  startCoordinates?: unknown;
  finishCoordinates?: unknown;
  start_location?: unknown;
  end_location?: unknown;
  google_route_url?: unknown;
};

const POINT_KINDS: readonly PointKind[] = ['start', 'via', 'finish'];

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeCoordinates = (value: unknown): LatLng | undefined => {
  const parsed = parsePointInput(value);
  return parsed ?? undefined;
};

const normalizePoint = (
  value: unknown,
  fallbackOrder: number,
): TaskPoint | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const kindRaw = normalizeText(raw.kind);
  if (!kindRaw || !POINT_KINDS.includes(kindRaw as PointKind)) return null;

  const coords = normalizeCoordinates(raw.coordinates);
  const orderValue = Number(raw.order);
  const order = Number.isFinite(orderValue) ? orderValue : fallbackOrder;

  const title = normalizeText(raw.title);
  const sourceUrl = normalizeText(raw.sourceUrl);

  return {
    order,
    kind: kindRaw as PointKind,
    title: title ?? undefined,
    sourceUrl: sourceUrl ?? undefined,
    coordinates: coords,
  };
};

export const normalizeTaskPoints = (value: unknown): TaskPoint[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => normalizePoint(item, index))
    .filter((item): item is TaskPoint => Boolean(item))
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({
      ...item,
      order: Number.isFinite(item.order) ? item.order : index,
    }));
};

const findByKind = (
  points: TaskPoint[],
  kinds: PointKind[],
): TaskPoint | undefined => points.find((point) => kinds.includes(point.kind));

const findLastByKind = (
  points: TaskPoint[],
  kinds: PointKind[],
): TaskPoint | undefined => {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (kinds.includes(points[i].kind)) {
      return points[i];
    }
  }
  return undefined;
};

const buildFromLegacy = (
  start: LatLng | undefined,
  finish: LatLng | undefined,
  titles: { start?: string; finish?: string },
  sourceUrl?: string,
): TaskPoint[] => {
  const result: TaskPoint[] = [];
  if (start) {
    result.push({
      order: result.length,
      kind: 'start',
      coordinates: start,
      title: titles.start,
      sourceUrl,
    });
  }
  if (finish) {
    result.push({
      order: result.length,
      kind: 'finish',
      coordinates: finish,
      title: titles.finish,
      sourceUrl,
    });
  }
  return result;
};

export const syncTaskPoints = (target: TaskPointTarget): void => {
  const hasPointsUpdate = Array.isArray(target.points);
  const normalizedPoints = hasPointsUpdate
    ? normalizeTaskPoints(target.points)
    : [];

  const startLegacy = normalizeCoordinates(target.startCoordinates);
  const finishLegacy = normalizeCoordinates(target.finishCoordinates);

  if (hasPointsUpdate) {
    const startPoint =
      findByKind(normalizedPoints, ['start', 'via']) ?? normalizedPoints[0];
    const finishPoint =
      findLastByKind(normalizedPoints, ['finish', 'via', 'start']) ??
      (normalizedPoints.length ? normalizedPoints[normalizedPoints.length - 1] : undefined);

    target.points = normalizedPoints as TaskDocument['points'];
    target.startCoordinates = startPoint?.coordinates ?? null;
    target.finishCoordinates = finishPoint?.coordinates ?? null;

    if (!target.start_location && startPoint?.title) {
      target.start_location = startPoint.title;
    }
    if (!target.end_location && finishPoint?.title) {
      target.end_location = finishPoint.title;
    }
    if (!target.google_route_url) {
      const sourceUrl = startPoint?.sourceUrl ?? finishPoint?.sourceUrl;
      if (sourceUrl) {
        target.google_route_url = sourceUrl;
      }
    }
    return;
  }

  if (!startLegacy && !finishLegacy) {
    return;
  }

  const points = buildFromLegacy(
    startLegacy,
    finishLegacy,
    {
      start: normalizeText(target.start_location),
      finish: normalizeText(target.end_location),
    },
    normalizeText(target.google_route_url),
  );

  if (points.length) {
    target.points = points as TaskDocument['points'];
  }
  if (startLegacy) {
    target.startCoordinates = startLegacy;
  }
  if (finishLegacy) {
    target.finishCoordinates = finishLegacy;
  }
};

export const extractLegacyCoordinates = (
  points?: TaskPoint[] | null,
): { start?: LatLng; finish?: LatLng } => {
  if (!points || !points.length) {
    return {};
  }
  const normalized = normalizeTaskPoints(points);
  const start = findByKind(normalized, ['start', 'via']) ?? normalized[0];
  const finish =
    findLastByKind(normalized, ['finish', 'via', 'start']) ??
    (normalized.length ? normalized[normalized.length - 1] : undefined);
  return {
    start: start?.coordinates,
    finish: finish?.coordinates,
  };
};
