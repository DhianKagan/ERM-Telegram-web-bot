// apps/worker/src/utils/geo.ts
/**
 * Общая небольшая библиотека гео-утилит для нормализации координат и проверки.
 * Экспортируем:
 *  - normalizePointsString(raw: string): [lon, lat][]
 *  - haversineDistanceMeters(a, b)
 *  - precheckLocations(locations)
 *
 * Параметры поведения управляются через env:
 *  - ROUTE_PRECISION_DECIMALS (default 6)
 *  - ROUTE_MAX_SEGMENT_M (default 200000) — максимальная длина сегмента в метрах
 */

const PRECISION_DECIMALS = Number(process.env.ROUTE_PRECISION_DECIMALS || '6');
const DEFAULT_MAX_SEGMENT_M = Number(process.env.ROUTE_MAX_SEGMENT_M || '200000'); // 200 km

export type PointTuple = [number, number];

export function roundCoord(value: number, decimals = PRECISION_DECIMALS): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function isValidLat(lat: number) {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}
export function isValidLon(lon: number) {
  return Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

/**
 * Normalize string like "lon,lat;lon2,lat2;..."
 * - trims whitespace
 * - splits on ';' or '|' (default ';')
 * - rounds coords to PRECISION_DECIMALS
 * - drops consecutive duplicate points
 * - drops invalid coords
 */
export function normalizePointsString(raw: string): PointTuple[] {
  if (!raw || typeof raw !== 'string') return [];
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

/**
 * Haversine distance between two points [lon, lat] in meters
 */
export function haversineDistanceMeters(a: PointTuple, b: PointTuple): number {
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

/**
 * Precheck locations
 * - ensure >=2 points
 * - ensure each segment length <= maxSegmentM (env ROUTE_MAX_SEGMENT_M or default)
 *
 * Returns { ok: true } or { ok: false, reason: string, ...details }
 */
export function precheckLocations(locations: PointTuple[]) {
  if (!locations || locations.length < 2) return { ok: false, reason: 'too_few_points' };
  const maxSegmentM = Number(process.env.ROUTE_MAX_SEGMENT_M || DEFAULT_MAX_SEGMENT_M);
  for (let i = 0; i < locations.length - 1; i++) {
    const a = locations[i];
    const b = locations[i + 1];
    const d = haversineDistanceMeters(a, b);
    if (!Number.isFinite(d)) return { ok: false, reason: 'invalid_segment', index: i };
    if (d > maxSegmentM) {
      return { ok: false, reason: 'segment_too_long', index: i, distanceMeters: d, maxSegmentM };
    }
  }
  return { ok: true };
}
