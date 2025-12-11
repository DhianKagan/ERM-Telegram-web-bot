// apps/api/src/utils/taskPointsInput.ts
// Назначение: подготовка и валидация точек маршрута задач.
// Основные модули: utils/geo, utils/parseGoogleAddress, services/maps
import { extractCoords } from 'shared';
import type { TaskPoint } from '../db/model';
import { latLngToLonLat, parsePointInput, precheckLocations } from './geo';
import parseGoogleAddress from './parseGoogleAddress';
import { normalizeTaskPoints } from './taskPoints';
import { expandMapsUrl } from '../services/maps';

const MAX_POINTS = 10;

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

export type TaskPointsErrorCode =
  | 'points_limit_exceeded'
  | 'invalid_point'
  | 'invalid_segment';

export class TaskPointsValidationError extends Error {
  code: TaskPointsErrorCode;

  details?: unknown;

  constructor(code: TaskPointsErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

const resolvePointCoordinates = (
  rawCoordinates: unknown,
  sourceUrl?: string,
): { lat: number; lng: number } | null => {
  const coords = parsePointInput(rawCoordinates ?? sourceUrl ?? null);
  if (coords) {
    return coords;
  }
  if (sourceUrl) {
    const extracted = extractCoords(sourceUrl);
    if (extracted) {
      return { lat: extracted.lat, lng: extracted.lng };
    }
  }
  return null;
};

export async function prepareIncomingPoints(
  value: unknown,
): Promise<TaskPoint[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }
  if (value.length > MAX_POINTS) {
    throw new TaskPointsValidationError(
      'points_limit_exceeded',
      'Количество точек не должно превышать 10',
      { max: MAX_POINTS },
    );
  }

  const normalized: TaskPoint[] = [];

  for (let i = 0; i < value.length; i += 1) {
    const rawPoint = value[i];
    if (!rawPoint || typeof rawPoint !== 'object') {
      throw new TaskPointsValidationError(
        'invalid_point',
        `Точка ${i + 1} должна быть объектом с координатами`,
        { index: i },
      );
    }
    const payload = rawPoint as Record<string, unknown>;
    const kind = normalizeText(payload.kind);
    if (!kind || !['start', 'via', 'finish'].includes(kind)) {
      throw new TaskPointsValidationError(
        'invalid_point',
        `Некорректный тип точки ${i + 1}`,
        { index: i },
      );
    }

    const orderRaw = Number(payload.order);
    const order = Number.isFinite(orderRaw) ? orderRaw : i;
    const sourceUrlRaw = normalizeText(payload.sourceUrl);
    let sourceUrl = sourceUrlRaw;
    if (sourceUrlRaw) {
      try {
        sourceUrl = await expandMapsUrl(sourceUrlRaw);
      } catch (error) {
        throw new TaskPointsValidationError(
          'invalid_point',
          `Не удалось обработать ссылку точки ${i + 1}`,
          { index: i, message: (error as Error).message },
        );
      }
    }

    const coordinates = resolvePointCoordinates(payload.coordinates, sourceUrl);
    if (!coordinates) {
      throw new TaskPointsValidationError(
        'invalid_point',
        `Некорректные координаты точки ${i + 1}`,
        { index: i },
      );
    }

    const titleCandidate = normalizeText(payload.title);
    const title =
      titleCandidate ?? (sourceUrl ? parseGoogleAddress(sourceUrl) : undefined);

    normalized.push({
      order,
      kind: kind as TaskPoint['kind'],
      sourceUrl: sourceUrl ?? undefined,
      coordinates,
      title: title ?? undefined,
    });
  }

  const points = normalizeTaskPoints(normalized);

  const coordsList = points.map((point) => latLngToLonLat(point.coordinates!));
  const precheck = precheckLocations(coordsList);
  if (!precheck.ok) {
    throw new TaskPointsValidationError(
      'invalid_segment',
      'Маршрут содержит некорректные сегменты',
      precheck,
    );
  }

  return points;
}
