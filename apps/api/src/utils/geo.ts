// apps/api/src/utils/geo.ts
// Общие гео-функции для API и воркера: парсинг входных координат, нормализация,
// пред-проверки сегментов, дистанция (haversine).
export type LatLng = { lat: number; lng: number };
export type LonLatPair = [number, number]; // [lon, lat]

const PRECISION_DECIMALS = Number(process.env.ROUTE_PRECISION_DECIMALS || '6');
export const MAX_SEGMENT_M = Number(process.env.ROUTE_MAX_SEGMENT_M || '200000'); // 200km default

function roundCoord(value: number, decimals = PRECISION_DECIMALS): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function isValidLat(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}
function isValidLon(lon: number): boolean {
  return Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

/**
 * Normalize points string "lon,lat;lon2,lat2;..." or with '|' separator.
 * Returns array of [lon, lat].
 */
export function normalizePointsString(raw: string): LonLatPair[] {
  if (!raw || typeof raw !== 'string') return [];
  const sep = raw.indexOf(';') >= 0 ? ';' : raw.indexOf('|') >= 0 ? '|' : ';';
  const parts = raw.split(sep);
  const out: LonLatPair[] = [];
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

/** Haversine — meters */
export function haversineDistanceMeters(a: LonLatPair, b: LonLatPair): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000;
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

export function precheckLocations(locations: LonLatPair[]) {
  if (!locations || locations.length < 2) {
    return { ok: false, reason: 'too_few_points' };
  }
  for (let i = 0; i < locations.length - 1; i++) {
    const a = locations[i];
    const b = locations[i + 1];
    const d = haversineDistanceMeters(a, b);
    if (!Number.isFinite(d)) {
      return { ok: false, reason: 'invalid_segment', index: i };
    }
    if (d > MAX_SEGMENT_M) {
      return {
        ok: false,
        reason: 'segment_too_long',
        index: i,
        distanceMeters: d,
        maxSegmentM: MAX_SEGMENT_M,
      };
    }
  }
  return { ok: true };
}

/**
 * Parse an incoming point value to a LatLng object or null.
 * Accepts:
 *  - object { lat:number, lng:number } or { lng, lat }
 *  - JSON strings like '{"lat":..,"lng":..}'
 *  - strings "lon,lat" or "lat,lng" (we will try to detect)
 *
 * Returns: {lat, lng} with numbers (rounded), or null if invalid.
 */
export function parsePointInput(input: unknown): LatLng | null {
  if (input == null) return null;

  // If it's an object
  if (typeof input === 'object' && !Array.isArray(input)) {
    // @ts-ignore - index access
    const maybeLat = (input as any).lat;
    const maybeLng = (input as any).lng;
    // Sometimes object might have {latitude,longitude} or {lat,lon}
    const maybeLatitude = (input as any).latitude ?? maybeLat;
    const maybeLongitude = (input as any).longitude ?? (input as any).lon ?? maybeLng ?? (input as any).lng;
    const latN = Number(maybeLatitude);
    const lngN = Number(maybeLongitude);
    if (Number.isFinite(latN) && Number.isFinite(lngN) && isValidLat(latN) && isValidLon(lngN)) {
      return { lat: roundCoord(latN), lng: roundCoord(lngN) };
    }
    // Try swapped keys (lng, lat)
    const maybeLat2 = (input as any).lng;
    const maybeLng2 = (input as any).lat;
    const lat2 = Number(maybeLat2);
    const lng2 = Number(maybeLng2);
    if (Number.isFinite(lat2) && Number.isFinite(lng2) && isValidLat(lat2) && isValidLon(lng2)) {
      return { lat: roundCoord(lat2), lng: roundCoord(lng2) };
    }
    return null;
  }

  // If it's a string
  if (typeof input === 'string') {
    const s = input.trim();
    // Try JSON
    if (s.startsWith('{') && s.endsWith('}')) {
      try {
        const parsed = JSON.parse(s);
        return parsePointInput(parsed);
      } catch {
        // fallthrough
      }
    }
    // Try "lon,lat" or "lat,lng"
    const parts = s.split(',').map((x) => x.trim());
    if (parts.length === 2) {
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        // prefer treat as lon,lat if valid
        if (isValidLon(a) && isValidLat(b)) {
          return { lat: roundCoord(b), lng: roundCoord(a) };
        }
        // maybe it is lat,lng
        if (isValidLat(a) && isValidLon(b)) {
          return { lat: roundCoord(a), lng: roundCoord(b) };
        }
      }
    }
    // Not parseable
    return null;
  }

  return null;
}
