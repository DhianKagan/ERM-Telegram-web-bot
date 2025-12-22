// apps/worker/src/tasks/routing.ts
// Worker: task for calculating route distance
import type { Coordinates, RouteDistanceJobResult } from 'shared';
import type { WorkerConfig } from '../config';
import { logger } from '../logger';
import {
  normalizePointsString,
  precheckLocations,
  parsePointInput,
  LatLng,
} from '../utils/geo';

const REQUEST_TIMEOUT_MS = Number(process.env.WORKER_ROUTE_TIMEOUT_MS || '30000'); // 30s default

type OsrmResponse = {
  code?: string;
  routes?: Array<{ distance?: number }>;
};

const buildRouteUrl = (
  config: WorkerConfig['routing'],
  coordsStr: string,
): URL => {
  // Защита от случая, когда baseUrl отсутствует — в таком случае вызовы маршрутизации
  // не должны происходить (config.enabled должен быть false), но для безопасности
  // и корректности типов проверяем это явно.
  if (!config.baseUrl) {
    throw new Error('Routing baseUrl is not configured');
  }

  // Теперь compiler знает, что baseUrl — строка
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

function normalizeWorkerPoint(input: Coordinates | string | undefined): LatLng | null {
  // Accept Coordinates object or string
  if (!input) return null;
  // If already object with lat/lng
  if (typeof input === 'object') {
    // try parse using parsePointInput
    return parsePointInput(input);
  }
  if (typeof input === 'string') {
    return parsePointInput(input);
  }
  return null;
}

export const calculateRouteDistance = async (
  startRaw: Coordinates,
  finishRaw: Coordinates,
  config: WorkerConfig['routing'],
): Promise<RouteDistanceJobResult> => {
  if (!config.enabled) {
    return { distanceKm: null };
  }

  // Normalize inputs
  const startParsed = normalizeWorkerPoint(startRaw as unknown as Coordinates);
  const finishParsed = normalizeWorkerPoint(finishRaw as unknown as Coordinates);

  if (!startParsed || !finishParsed) {
    logger.warn({ startRaw, finishRaw }, 'calculateRouteDistance: invalid raw coordinates after parse');
    return { distanceKm: null };
  }

  // use normalized lon,lat string for route
  const rawPoints = `${startParsed.lng},${startParsed.lat};${finishParsed.lng},${finishParsed.lat}`;

  const locations = normalizePointsString(rawPoints);
  if (locations.length < 2) {
    logger.warn({ startParsed, finishParsed }, 'calculateRouteDistance: normalized to fewer than 2 points');
    return { distanceKm: null };
  }
  const pre = precheckLocations(locations);
  if (!pre.ok) {
    logger.warn({ pre, startParsed, finishParsed }, 'calculateRouteDistance precheck failed');
    return { distanceKm: null };
  }

  const normalizedCoords = locations.map((p) => `${p[0]},${p[1]}`).join(';');

  // buildRouteUrl теперь безопасно проверяет наличие baseUrl
  let url: URL;
  try {
    url = buildRouteUrl(config, normalizedCoords);
  } catch (err) {
    logger.warn({ err, config }, 'calculateRouteDistance: routing baseUrl missing or invalid');
    return { distanceKm: null };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {};
    if (config.proxyToken) headers['X-Proxy-Token'] = config.proxyToken || '';

    // optional tracing
    try {
      const mod = await import('../utils/trace');
      const trace = typeof mod.getTrace === 'function' ? mod.getTrace() : undefined;
      if (trace && typeof trace === 'object' && 'traceparent' in trace) {
        const traceparent = (trace as { traceparent?: unknown }).traceparent;
        if (typeof traceparent === 'string') {
          headers['traceparent'] = traceparent;
        }
      }
    } catch {
      // ignore if tracing not available
    }

    const startTime = Date.now();
    const response = await fetch(url.toString(), { signal: controller.signal, headers });
    const raw = await response.text();
    let payload: OsrmResponse | null = null;
    try {
      payload = raw ? (JSON.parse(raw) as OsrmResponse) : null;
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

    const distanceMeters = payload?.routes?.[0]?.distance;
    if (typeof distanceMeters !== 'number') {
      return { distanceKm: null };
    }
    const distanceKm = Number((distanceMeters / 1000).toFixed(1));
    return { distanceKm } as RouteDistanceJobResult;
  } catch (error) {
    const name = (error as { name?: unknown }).name;
    const isAbort = typeof name === 'string' && name === 'AbortError';
    const level = isAbort ? 'warn' : 'error';
    logger[level]({ start: startParsed, finish: finishParsed, error }, 'Unable to fetch route (worker)');
    return { distanceKm: null };
  } finally {
    clearTimeout(timeout);
  }
};
