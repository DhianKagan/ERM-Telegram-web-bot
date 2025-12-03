// Назначение: получение маршрута через OSRM
// Основные модули: fetch
import type { Position } from 'geojson';

type Point = { lng: number; lat: number };

type CacheEntry = { value: Position[] | null; expiresAt: number };

const DEFAULT_ROUTE_CACHE_TTL_MS = 10 * 60 * 1000;

const parsePositiveInt = (value?: string): number => {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.NaN;
};

const isRouteCacheEnabled = (): boolean => {
  const rawEnabled = import.meta.env.VITE_ROUTE_CACHE_ENABLED;
  if (typeof rawEnabled === 'string' && rawEnabled.trim() === '0') {
    return false;
  }
  return true;
};

const getRouteCacheTtl = (): number => {
  const ttlSeconds = parsePositiveInt(import.meta.env.VITE_ROUTE_CACHE_TTL);
  if (Number.isFinite(ttlSeconds)) {
    return ttlSeconds * 1000;
  }
  const ttlMs = parsePositiveInt(import.meta.env.VITE_ROUTE_CACHE_TTL_MS);
  if (Number.isFinite(ttlMs)) {
    return ttlMs;
  }
  return DEFAULT_ROUTE_CACHE_TTL_MS;
};

const routeCache = new Map<string, CacheEntry>();
const inflightRoutes = new Map<string, Promise<Position[] | null>>();

const buildPointsParam = (start: Point, end: Point): string =>
  `${start.lng},${start.lat};${end.lng},${end.lat}`;

export const clearRouteCache = (): void => {
  routeCache.clear();
  inflightRoutes.clear();
};

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
  const pointsParam = buildPointsParam(start, end);
  const cacheEnabled = isRouteCacheEnabled();
  const ttlMs = getRouteCacheTtl();
  const useCache = cacheEnabled && ttlMs > 0;
  if (!useCache) {
    clearRouteCache();
  }
  const now = Date.now();
  const cacheKey = buildRouteKey(start, end);
  if (useCache) {
    const cached = routeCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }
    const inflight = inflightRoutes.get(cacheKey);
    if (inflight) {
      return inflight;
    }
  }
  const request = (async () => {
    const apiGeometry = await fetch(
      `/api/v1/osrm/geometry?points=${encodeURIComponent(pointsParam)}`,
      {
        credentials: 'include',
      },
    )
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('OSRM недоступен');
        }
        const data = (await res.json()) as { coordinates?: Position[] };
        return Array.isArray(data.coordinates) ? data.coordinates : null;
      })
      .catch(() => null);

    if (apiGeometry) {
      const expiresAt = now + ttlMs;
      if (useCache) {
        routeCache.set(cacheKey, { value: apiGeometry, expiresAt });
      }
      return apiGeometry;
    }

    const base =
      import.meta.env.VITE_ROUTING_URL ||
      'https://router.project-osrm.org/route/v1/driving';
    const url = `${base}/${pointsParam}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('OSRM недоступен');
    }
    const data = await response.json();
    const geometry =
      (data.routes?.[0]?.geometry?.coordinates as Position[] | undefined) ||
      null;
    if (useCache) {
      const expiresAt = now + ttlMs;
      routeCache.set(cacheKey, { value: geometry, expiresAt });
    }
    return geometry;
  })().finally(() => {
    inflightRoutes.delete(cacheKey);
  });
  if (useCache) {
    inflightRoutes.set(cacheKey, request);
  }
  return request;
};

export default fetchRouteGeometry;
