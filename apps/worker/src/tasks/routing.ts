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

/**
 * Minimal typed representation of the ORS/OSRM-like response we expect.
 * We model the parts we read (routes[0].distance, code) and leave the rest unknown.
 */
type OrsRoute = {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: Array<[number, number]> } | string | null;
    segments?: unknown;
    summary?: unknown;
  }>;
  waypoints?: unknown;
  [k: string]: unknown;
};

function isOrsRoute(obj: unknown): obj is OrsRoute {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as OrsRoute;
  // If it has either code or routes array it's probably the expected shape
  return 'code' in o || Array.isArray(o.routes);
}

/**
 * Calculates route distance between two coordinates using the worker routing service.
 * Returns { distanceKm: number | null }.
 */
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

    // Optional: try to import trace getter from api utils (may not exist)
    try {
      // dynamic import of API trace util
      const traceModule = await import('../../api/src/utils/trace').catch(() => null);
      if (traceModule && typeof traceModule.getTrace === 'function') {
        const traceResult = traceModule.getTrace();
        if (traceResult && typeof traceResult.traceparent === 'string') {
          headers['traceparent'] = traceResult.traceparent;
        }
      }
    } catch {
      // ignore tracing errors
    }

    const startTime = Date.now();
    const response = await fetch(url, { signal: controller.signal, headers });
    const raw = await response.text();

    // Attempt to parse JSON safely as unknown
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      // non-JSON response — log truncated raw and return null (we can't interpret)
      logger.warn(
        { url: url.toString(), status: response.status, raw: raw ? raw.slice(0, 2000) + '...[truncated]' : '' },
        'Worker: non-json response from routing service',
      );
      return { distanceKm: null };
    }

    // Ensure parsed object matches expected shape
    if (!isOrsRoute(parsed)) {
      logger.warn({ url: url.toString(), status: response.status, parsed }, 'Worker: unexpected response shape from routing service');
      return { distanceKm: null };
    }

    const durationMs = Date.now() - startTime;
    logger.info({ url: url.toString(), durationMs, status: response.status }, 'Worker: route call');

    // If upstream returned non-ok or code not Ok — treat as no-route
    const ors = parsed as OrsRoute;
    if (!response.ok || (ors.code && ors.code !== 'Ok')) {
      logger.warn({ status: response.status, ors }, 'OSRM/ORS returned error in worker');
      return { distanceKm: null };
    }

    // Get distance safely
    const firstRoute = Array.isArray(ors.routes) ? ors.routes[0] : undefined;
    const distanceMeters = firstRoute && typeof firstRoute.distance === 'number' ? firstRoute.distance : undefined;
    if (typeof distanceMeters !== 'number') {
      logger.warn({ ors }, 'Worker: distance not present in ORS response');
      return { distanceKm: null };
    }

    const distanceKm = Number((distanceMeters / 1000).toFixed(1));
    return { distanceKm };
  } catch (err) {
    // err is unknown — treat safely
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const level = isAbort ? 'warn' : 'error';
    logger[level]({ start, finish, error: err instanceof Error ? { name: err.name, message: err.message } : String(err) }, 'Unable to fetch route (worker)');
    return { distanceKm: null };
  } finally {
    clearTimeout(timeout);
  }
};
