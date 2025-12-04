// Назначение: фоновые задачи расчёта расстояний OSRM
// Основные модули: fetch, logger
import type { Coordinates, RouteDistanceJobResult } from 'shared';
import type { WorkerConfig } from '../config';
import { logger } from '../logger';

const REQUEST_TIMEOUT_MS = 10000;

const isValidPoint = (point: Coordinates | undefined): point is Coordinates => {
  if (!point) {
    return false;
  }
  return Number.isFinite(point.lat) && Number.isFinite(point.lng);
};

const buildRouteUrl = (
  config: WorkerConfig['routing'],
  start: Coordinates,
  finish: Coordinates,
): URL => {
  const base = new URL(config.baseUrl);
  const normalizedPath = base.pathname.replace(/\/+$/, '');
  base.pathname = `${normalizedPath}/${start.lng},${start.lat};${finish.lng},${finish.lat}`;
  base.searchParams.set('overview', 'false');
  base.searchParams.set('annotations', 'distance');
  base.searchParams.set('steps', 'false');
  if (config.algorithm) {
    base.searchParams.set('algorithm', config.algorithm);
  }
  return base;
};

export const calculateRouteDistance = async (
  start: Coordinates,
  finish: Coordinates,
  config: WorkerConfig['routing'],
): Promise<RouteDistanceJobResult> => {
  if (!config.enabled) {
    return { distanceKm: null };
  }
  if (!isValidPoint(start) || !isValidPoint(finish)) {
    return { distanceKm: null };
  }

  const url = buildRouteUrl(config, start, finish);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const payload = await response.json();
    if (!response.ok || payload.code !== 'Ok') {
      logger.warn(
        {
          status: response.status,
          payload,
        },
        'OSRM вернул ошибку при расчёте маршрута',
      );
      return { distanceKm: null };
    }
    const distanceMeters = payload.routes?.[0]?.distance;
    if (typeof distanceMeters !== 'number') {
      return { distanceKm: null };
    }
    const distanceKm = Number((distanceMeters / 1000).toFixed(1));
    return { distanceKm } satisfies RouteDistanceJobResult;
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    const level = isAbort ? 'warn' : 'error';
    logger[level](
      {
        start,
        finish,
        error,
      },
      'Не удалось получить маршрут OSRM',
    );
    return { distanceKm: null };
  } finally {
    clearTimeout(timeout);
  }
};
