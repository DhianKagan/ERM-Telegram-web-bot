// Назначение: запросы к сервису OSRM
// Модули: fetch, config, prom-client
import { routingUrl } from '../config';
import { osrmRequestDuration, osrmErrorsTotal } from '../metrics';
import { getTrace } from '../utils/trace';
import { cacheGet, cacheSet, cacheClear } from '../utils/cache';

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

const buildEndpointUrl = (endpoint: Endpoint): URL => {
  const parts =
    routeSegmentIndex === -1
      ? [...routePathSegments, endpoint]
      : [
          ...routePathSegments.slice(0, routeSegmentIndex),
          endpoint,
        ];
  const normalized = parts.filter((segment) => segment.length > 0);
  const pathname = normalized.length ? `/${normalized.join('/')}` : '/';
  return new URL(pathname, `${routingUrlObject.origin}/`);
};

const allowed = ['table', 'nearest', 'match', 'trip', 'route'] as const;

type Endpoint = (typeof allowed)[number];

/** Проверка формата координат */
export function validateCoords(value: string): string {
  const coordRx =
    /^-?\d+(\.\d+)?,-?\d+(\.\d+)?(;-?\d+(\.\d+)?,-?\d+(\.\d+)?)*$/;
  if (!coordRx.test(value)) throw new Error('Некорректные координаты');
  return value;
}

async function call<T>(
  endpoint: Endpoint,
  coords: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  if (!allowed.includes(endpoint)) throw new Error('Неизвестный эндпойнт');
  const safeCoords = validateCoords(coords);
  const url = buildEndpointUrl(endpoint);
  url.searchParams.append(
    endpoint === 'nearest' ? 'point' : 'points',
    safeCoords,
  );
  for (const [k, v] of Object.entries(params))
    url.searchParams.append(k, String(v));
  const key = buildCacheKey(endpoint, safeCoords, params);
  const cached = await cacheGet<T>(key);
  if (cached) return cached;
  const trace = getTrace();
  const headers: Record<string, string> = {};
  if (trace) headers.traceparent = trace.traceparent;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const timer = osrmRequestDuration.startTimer({ endpoint });
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    const data = await res.json();
    if (!res.ok) {
      osrmErrorsTotal.inc({ endpoint, reason: String(res.status) });
      throw new Error(data.message || data.code || 'Route error');
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

export async function getRouteDistance(
  start: Point,
  end: Point,
): Promise<RouteDistance> {
  const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
  const key = buildCacheKey('route', coords, {});
  const cached = await cacheGet<RouteDistance>(key);
  if (cached) return cached;
  const routeBase = buildEndpointUrl('route');
  const routeUrl = new URL(routeBase.toString());
  const normalizedPath = routeUrl.pathname.replace(/\/+$/, '');
  routeUrl.pathname = `${normalizedPath}/${coords}`;
  routeUrl.searchParams.set('overview', 'false');
  routeUrl.searchParams.set('annotations', 'distance');
  routeUrl.searchParams.set('steps', 'false');
  const trace = getTrace();
  const headers: Record<string, string> = {};
  if (trace) headers.traceparent = trace.traceparent;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const timer = osrmRequestDuration.startTimer({ endpoint: 'route' });
  try {
    const res = await fetch(routeUrl, { headers, signal: controller.signal });
    const data = await res.json();
    if (!res.ok || data.code !== 'Ok') {
      osrmErrorsTotal.inc({ endpoint: 'route', reason: String(res.status) });
      throw new Error(data.message || data.code || 'Route error');
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

/** Сборка ключа кеша */
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

/** Очистка кеша маршрутов */
export const clearRouteCache = cacheClear;
