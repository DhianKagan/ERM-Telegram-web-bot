// apps/api/src/services/route.ts
import type { Position } from 'geojson';
import { routingUrl } from '../config';
import { osrmRequestDuration, osrmErrorsTotal } from '../metrics';
import { getTrace } from '../utils/trace';
import { cacheGet, cacheSet, cacheClear } from '../utils/cache';
import { logger } from '../services/wgLogEngine';

const tableGuard = process.env.ROUTE_TABLE_GUARD !== '0';
const defaultTableMaxPoints = 100;
let tableMaxPoints = Number(
  process.env.ROUTE_TABLE_MAX_POINTS || defaultTableMaxPoints,
);
if (!Number.isFinite(tableMaxPoints) || tableMaxPoints <= 0) {
  console.warn(
    `ROUTE_TABLE_MAX_POINTS должен быть положительным. Используется значение по умолчанию ${defaultTableMaxPoints}`,
  );
  tableMaxPoints = defaultTableMaxPoints;
}
const defaultTableMinInterval = 200;
let tableMinInterval = Number(
  process.env.ROUTE_TABLE_MIN_INTERVAL_MS || defaultTableMinInterval,
);
if (!Number.isFinite(tableMinInterval) || tableMinInterval <= 0) {
  console.warn(
    `ROUTE_TABLE_MIN_INTERVAL_MS должен быть положительным. Используется значение по умолчанию ${defaultTableMinInterval}`,
  );
  tableMinInterval = defaultTableMinInterval;
}
let tableLastCall = 0;

const routingUrlObject = new URL(routingUrl);
const routePathSegments = routingUrlObject.pathname
  .split('/')
  .filter((segment) => segment.length > 0);
const routeSegmentIndex = routePathSegments.lastIndexOf('route');

const routePrefixSegments =
  routeSegmentIndex === -1
    ? routePathSegments
    : routePathSegments.slice(0, routeSegmentIndex);
const routeProfileSegments =
  routeSegmentIndex === -1
    ? []
    : routePathSegments.slice(routeSegmentIndex + 1);

const buildEndpointUrl = (endpoint: Endpoint, coords?: string): URL => {
  const parts = [
    ...routePrefixSegments,
    endpoint,
    ...routeProfileSegments,
    ...(coords ? [coords] : []),
  ];
  const normalized = parts.filter((segment) => segment.length > 0);
  const pathname = normalized.length ? `/${normalized.join('/')}` : '/';
  return new URL(pathname, `${routingUrlObject.origin}/`);
};

const allowed = ['table', 'nearest', 'match', 'trip', 'route'] as const;

type Endpoint = (typeof allowed)[number];

export function validateCoords(value: string): string {
  const coordRx =
    /^-?\d+(\.\d+)?,-?\d+(\.\d+)?(;-?\d+(\.\d+)?,-?\d+(\.\d+)?)*$/;
  if (!coordRx.test(value)) throw new Error('Некорректные координаты');
  return value;
}

function getProxyToken(): string | undefined {
  const t1 = process.env.GEOCODER_PROXY_TOKEN;
  if (t1 && t1.trim()) return t1.trim();
  const t2 = process.env.PROXY_TOKEN;
  if (t2 && t2.trim()) return t2.trim();
  return undefined;
}

async function call<T>(
  endpoint: Endpoint,
  coords: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  if (!allowed.includes(endpoint)) throw new Error('Неизвестный эндпойнт');
  const safeCoords = validateCoords(coords);
  const url = buildEndpointUrl(endpoint, safeCoords);
  for (const [k, v] of Object.entries(params))
    url.searchParams.append(k, String(v));
  const key = buildCacheKey(endpoint, safeCoords, params);
  const cached = await cacheGet<T>(key);
  if (cached) return cached;
  const trace = getTrace();
  const headers: Record<string, string> = {};
  if (trace) headers.traceparent = trace.traceparent;

  const proxyToken = getProxyToken();
  if (proxyToken) {
    headers['X-Proxy-Token'] = proxyToken;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const timer = osrmRequestDuration.startTimer({ endpoint });
  try {
    const res = await fetch(url.toString(), { headers, signal: controller.signal });
    const raw = await res.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch (e) {
      logger.error({ url: url.toString(), status: res.status, body: raw }, 'Non-JSON response from routing service');
      throw new Error('Routing service returned non-JSON response');
    }
    if (!res.ok) {
      logger.error({ url: url.toString(), status: res.status, body: data }, 'Routing service error');
      osrmErrorsTotal.inc({ endpoint, reason: String(res.status) });
      throw new Error(data?.message || data?.code || `Route error status ${res.status}`);
    }
    timer({ endpoint, status: res.status });
    await cacheSet(key, data);
    return data as T;
  } catch (e) {
    osrmErrorsTotal.inc({
      endpoint,
      reason:
        e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'error',
    });
    timer({ endpoint, status: 0 });
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export interface Point {
  lat: number;
  lng: number;
}

export interface RouteDistance {
  distance: number | undefined;
  waypoints?: unknown;
}

export interface RouteGeometryResponse {
  routes?: Array<{ geometry?: { coordinates?: Position[] } | null }>;
}

export async function getRouteDistance(
  start: Point,
  end: Point,
): Promise<RouteDistance> {
  const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
  const key = buildCacheKey('route', coords, {});
  const cached = await cacheGet<RouteDistance>(key);
  if (cached) return cached;
  const routeUrl = buildEndpointUrl('route', coords);
  routeUrl.searchParams.set('overview', 'false');
  routeUrl.searchParams.set('annotations', 'distance');
  routeUrl.searchParams.set('steps', 'false');
  const trace = getTrace();
  const headers: Record<string, string> = {};
  if (trace) headers.traceparent = trace.traceparent;

  const proxyToken = getProxyToken();
  if (proxyToken) {
    headers['X-Proxy-Token'] = proxyToken;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const timer = osrmRequestDuration.startTimer({ endpoint: 'route' });
  try {
    const res = await fetch(routeUrl.toString(), { headers, signal: controller.signal });
    const raw = await res.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch (e) {
      logger.error({ url: routeUrl.toString(), status: res.status, body: raw }, 'Non-JSON response from routing service (route)');
      throw new Error('Routing service returned non-JSON response');
    }
    if (!res.ok || data?.code !== 'Ok') {
      logger.error({ url: routeUrl.toString(), status: res.status, body: data }, 'Routing service returned error for routeDistance');
      osrmErrorsTotal.inc({ endpoint: 'route', reason: String(res.status) });
      throw new Error(data?.message || data?.code || `Route error status ${res.status}`);
    }
    timer({ endpoint: 'route', status: res.status });
    const result = {
      distance: data.routes?.[0]?.distance,
      waypoints: data.waypoints,
    };
    await cacheSet(key, result);
    return result;
  } catch (e) {
    osrmErrorsTotal.inc({
      endpoint: 'route',
      reason:
        e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'error',
    });
    timer({ endpoint: 'route', status: 0 });
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export async function routeGeometry(
  points: string,
  params: Record<string, string | number> = {},
): Promise<Position[] | null> {
  const safePoints = validateCoords(points);
  const data = await call<RouteGeometryResponse>('route', safePoints, {
    overview: 'full',
    geometries: 'geojson',
    ...params,
  });
  const geometry = data.routes?.[0]?.geometry;
  if (!geometry || !Array.isArray(geometry.coordinates)) {
    return null;
  }
  return geometry.coordinates;
}

export async function table<T = unknown>(
  points: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  if (tableGuard) {
    const count = points.split(';').length;
    if (count > tableMaxPoints) throw new Error('Слишком много точек');
    const now = Date.now();
    const diff = now - tableLastCall;
    if (diff < tableMinInterval)
      await new Promise((r) => setTimeout(r, tableMinInterval - diff));
    tableLastCall = Date.now();
  }
  return call('table', points, params);
}

export async function nearest<T = unknown>(
  point: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  return call('nearest', point, params);
}

export async function match<T = unknown>(
  points: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  return call('match', points, params);
}

export async function trip<T = unknown>(
  points: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  return call('trip', points, params);
}

export function buildCacheKey(
  endpoint: string,
  coords: string,
  params: Record<string, string | number>,
): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params).sort())
    search.append(k, String(v));
  return `${endpoint}:${coords}:${search.toString()}`;
}

export const clearRouteCache = cacheClear;
