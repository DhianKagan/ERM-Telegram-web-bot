// Назначение: высокоуровневый клиент OSRM для вычисления дистанций
// Основные модули: services/route

import type { Point } from '../services/route';
import { getRouteDistance } from '../services/route';

export type OsrmPoint = Point;

export interface OsrmDistanceParams {
  start: OsrmPoint;
  finish: OsrmPoint;
}

const isValidPoint = (point: OsrmPoint | undefined): point is OsrmPoint => {
  if (!point) {
    return false;
  }
  return Number.isFinite(point.lat) && Number.isFinite(point.lng);
};

export const getOsrmDistance = async (
  params: OsrmDistanceParams,
): Promise<number | null> => {
  const { start, finish } = params;
  if (!isValidPoint(start) || !isValidPoint(finish)) {
    return null;
  }
  try {
    const result = await getRouteDistance(start, finish);
    if (typeof result.distance !== 'number') {
      return null;
    }
    return Number((result.distance / 1000).toFixed(1));
  } catch {
    return null;
  }
};
