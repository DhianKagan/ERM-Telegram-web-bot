// Назначение: получение маршрута через OSRM
// Основные модули: fetch
import type { Position } from 'geojson';

type Point = { lng: number; lat: number };

type CacheEntry = { value: Position[] | null; expiresAt: number };

const DEFAULT_ROUTE_CACHE_TTL_MS = 10 * 60 * 1000;

const getRouteCacheTtl = (): number => {
  const rawTtl = import.meta.env.VITE_ROUTE_CACHE_TTL_MS;
  const parsed = rawTtl ? Number.parseInt(rawTtl, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_ROUTE_CACHE_TTL_MS;
};

const routeCache = new Map<string, CacheEntry>();
const inflightRoutes = new Map<string, Promise<Position[] | null>>();

const isValidPoint = (point?: Point) => {
  if (!point) return false;
  const { lng, lat } = point;
  return Number.isFinite(lng) && Number.isFinite(lat);
};

const buildRouteKey = (start: Point, end: Point): string =>
  `${start.lng},${start.lat}-${end.lng},${end.lat}`;

export const fetchRouteGeometry = async (
  start: Point,
  end: Point,
): Promise<Position[] | null> => {
  if (!isValidPoint(start) || !isValidPoint(end)) {
    return null;
  }
  const now = Date.now();
  const cacheKey = buildRouteKey(start, end);
  const cached = routeCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  const inflight = inflightRoutes.get(cacheKey);
  if (inflight) {
    return inflight;
  }
  const base =
    import.meta.env.VITE_ROUTING_URL ||
    'https://router.project-osrm.org/route/v1/driving';
  const url = `${base}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
  const request = fetch(url)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error('OSRM недоступен');
      }
      const data = await res.json();
      const geometry =
        (data.routes?.[0]?.geometry?.coordinates as Position[] | undefined) ||
        null;
      const expiresAt = now + getRouteCacheTtl();
      routeCache.set(cacheKey, { value: geometry, expiresAt });
      return geometry;
    })
    .finally(() => {
      inflightRoutes.delete(cacheKey);
    });
  inflightRoutes.set(cacheKey, request);
  return request;
};

export default fetchRouteGeometry;
