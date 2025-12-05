// apps/worker/src/tasks/routing.ts
// Назначение: фоновые задачи расчёта расстояний OSRM (воркер)
// Включает локальную нормализацию координат и precheck на максимальную дистанцию.

import type { Coordinates, RouteDistanceJobResult } from 'shared';
import type { WorkerConfig } from '../config';
import { logger } from '../logger';

const REQUEST_TIMEOUT_MS = Number(process.env.WORKER_ROUTE_TIMEOUT_MS || '30000'); // 30s default
const PRECISION_DECIMALS = Number(process.env.ROUTE_PRECISION_DECIMALS || '6');
const MAX_SEGMENT_M = Number(process.env.ROUTE_MAX_SEGMENT_M || '200000'); // 200 km

type PointTuple = [number, number];

const isValidPoint = (point: Coordinates | undefined): point is Coordinates => {
  if (!point) return false;
  return Number.isFinite(point.lat) && Number.isFinite(point.lng);
};

function roundCoord(value: number, decimals = PRECISION_DECIMALS): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function isValidLat(lat: number) {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}
function isValidLon(lon: number) {
  return Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

export function normalizePointsString(raw: string): PointTuple[] {
  const sep = raw.indexOf(';') >= 0 ? ';' : raw.indexOf('|') >= 0 ? '|' : ';';
  const parts = raw.split(sep);
  const out: PointTuple[] = [];
  for (let p of parts) {
    p = p.trim();
    if (!p) continue;
    const coords = p.split(',').map((s) => s.trim());
    if (coords.length !== 2) continue;
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    if (!isValidLon(lon) || !isValidLat(lat)) continue;
    const rl = roundCoord(lat);
    const rl0 = roundCoord(lon);
    if (out.length > 0) {
      const [lastLon, lastLat] = out[out.length - 1];
      if (lastLon === rl0 && lastLat === rl) continue;
    }
    out.push([rl0, rl]);
  }
  return out;
}

function haversineDistanceMeters(a: PointTuple, b: PointTuple): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000; // m
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const aa = sinDlat * sinDlat + sinDlon * sinDlon * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

function precheckLocations(locations: PointTuple[]) {
  if (!locations || locations.length < 2) {
    return { ok: false, reason: 'too_few_points' };
  }
  for (let i = 0; i < locations.length - 1; i++) {
    const a = locations[i];
    const b = locations[i + 1];
    const d = haversineDistanceMeters(a, b);
    if (!Number.isFinite(d)) return { ok: false, reason: 'invalid_segment', index: i };
    if (d > MAX_SEGMENT_M) return { ok: false, reason: 'segment_too_long', index: i, distanceMeters: d, maxSegmentM: MAX_SEGMENT_M };
  }
  return { ok: true };
}

const buildRouteUrl = (config: WorkerConfig['routing'], coordsStr: string): URL => {
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
  if (!config.enabled) return { distanceKm: null };
  if (!isValidPoint(start) || !isValidPoint(finish)) return { distanceKm: null };

  // Normalize and precheck
  const pointsParam = `${start.lng},${start.lat};${finish.lng},${finish.lat}`;
  const locations = normalizePointsString(pointsParam);
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

    // optional trace
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getTrace } = require('../utils/trace');
      const trace = getTrace && getTrace();
      if (trace && trace.traceparent) headers['traceparent'] = trace.traceparent;
    } catch {
      // ignore if trace not available
    }

    const startTime = Date.now();
    const response = await fetch(url, { signal: controller.signal, headers });
    const raw = await response.text();
    let payload: any = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      logger.warn({ url: url.toString(), status: response.status, raw: raw && raw.slice(0, 2000) + '...[truncated]' }, 'Worker: non-json response from routing service');
      return { distanceKm: null };
    }

    // log outbound call summary
    const durationMs = Date.now() - startTime;
    logger.info({ url: url.toString(), durationMs, status: response.status }, 'Worker: route call');

    if (!response.ok || payload?.code !== 'Ok') {
      logger.warn({ status: response.status, payload }, 'OSRM returned error in worker');
      return { distanceKm: null };
    }
    const distanceMeters = payload.routes?.[0]?.distance;
    if (typeof distanceMeters !== 'number') return { distanceKm: null };
    const distanceKm = Number((distanceMeters / 1000).toFixed(1));
    return { distanceKm } satisfies RouteDistanceJobResult;
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    const level = isAbort ? 'warn' : 'error';
    logger[level]({ start, finish, error }, 'Не удалось получить маршрут OSRM (worker)');
    return { distanceKm: null };
  } finally {
    clearTimeout(timeout);
  }
};
