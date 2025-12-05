// apps/worker/src/tasks/routing.ts
// Worker: task for calculating route distance
import type { Coordinates, RouteDistanceJobResult } from 'shared';
import type { WorkerConfig } from '../config';
import { logger } from '../logger';
import { normalizePointsString, precheckLocations } from '../utils/geo';

const REQUEST_TIMEOUT_MS = Number(process.env.WORKER_ROUTE_TIMEOUT_MS || '30000'); // 30s default

const isValidPoint = (point: Coordinates | undefined): point is Coordinates => {
  if (!point) {
    return false;
  }
  return Number.isFinite(point.lat) && Number.isFinite(point.lng);
};

const buildRouteUrl = (
  config: WorkerConfig['routing'],
  coordsStr: string,
): URL => {
  const base = new URL(config.baseUrl);
  const normalizedPath = base.pathname.replace(/\/+$/, '');
  base.pathname = `${normalizedPath}/${coordsStr}`;
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

  // Normalize and precheck
  const rawPoints = `${start.lng},${start.lat};${finish.lng},${finish.lat}`;
  const locations = normalizePointsString(rawPoints);
  if (locations.length < 2) {
    logger.warn({ start, finish }, 'calculateRouteDistance: normalized to fewer than 2 points');
    return { distanceKm: null };
  }
  const pre = precheckLocations(locations);
  if (!pre.ok) {
    logger.warn({ pre, start, finish }, 'calculateRouteDistance precheck failed');
    return { distanceKm: null };
  }

  const normalizedCoords = locations.map((p) => `${p[0]},${p[1]}`).join(';');
  const url = buildRouteUrl(config, normalizedCoords);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {};
    if (config.proxyToken) headers['X-Proxy-Token'] = config.proxyToken;

    // optional tracing
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getTrace } = require('../utils/trace');
      const trace = getTrace && getTrace();
      if (trace && trace.traceparent) {
        headers['traceparent'] = trace.traceparent;
      }
    } catch {
      // ignore if tracing not available
    }

    const startTime = Date.now();
    const response = await fetch(url, { signal: controller.signal, headers });
    const raw = await response.text();
    let payload: any = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      logger.warn(
        { url: url.toString(), status: response.status, raw: raw && raw.slice(0, 2000) + '...[truncated]' },
        'Worker: non-json response from routing service',
      );
      return { distanceKm: null };
    }

    const durationMs = Date.now() - startTime;
    logger.info({ url: url.toString(), durationMs, status: response.status }, 'Worker: route call');

    if (!response.ok || payload?.code !== 'Ok') {
      logger.warn({ status: response.status, payload }, 'OSRM returned error in worker');
      return { distanceKm: null };
    }

    const distanceMeters = payload.routes?.[0]?.distance;
    if (typeof distanceMeters !== 'number') {
      return { distanceKm: null };
    }
    const distanceKm = Number((distanceMeters / 1000).toFixed(1));
    return { distanceKm } as RouteDistanceJobResult;
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    const level = isAbort ? 'warn' : 'error';
    logger[level]({ start, finish, error }, 'Unable to fetch route (worker)');
    return { distanceKm: null };
  } finally {
    clearTimeout(timeout);
  }
};
