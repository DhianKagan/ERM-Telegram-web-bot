// Назначение: общие гео-утилиты для API и worker.
// Модули: mapUtils

import { extractCoords } from './mapUtils';

export type LatLng = { lat: number; lng: number };
export type LonLatPair = [number, number]; // [lon, lat]

export const DEFAULT_PRECISION_DECIMALS = 6;
export const DEFAULT_MAX_SEGMENT_M = 200000;

export function roundCoord(
  value: number,
  decimals = DEFAULT_PRECISION_DECIMALS,
): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function isValidLat(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

export function isValidLon(lon: number): boolean {
  return Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

export function normalizePointsString(
  raw: string,
  precisionDecimals = DEFAULT_PRECISION_DECIMALS,
): LonLatPair[] {
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
    const normalizedLat = roundCoord(lat, precisionDecimals);
    const normalizedLon = roundCoord(lon, precisionDecimals);
    if (out.length > 0) {
      const [lastLon, lastLat] = out[out.length - 1];
      if (lastLon === normalizedLon && lastLat === normalizedLat) continue;
    }
    out.push([normalizedLon, normalizedLat]);
  }
  return out;
}

export function haversineDistanceMeters(a: LonLatPair, b: LonLatPair): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const aa =
    sinDlat * sinDlat + sinDlon * sinDlon * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return earthRadiusMeters * c;
}

export function precheckLocations(
  locations: LonLatPair[],
  maxSegmentM = DEFAULT_MAX_SEGMENT_M,
) {
  if (!locations || locations.length < 2) {
    return { ok: false, reason: 'too_few_points' as const };
  }
  for (let i = 0; i < locations.length - 1; i++) {
    const a = locations[i];
    const b = locations[i + 1];
    const d = haversineDistanceMeters(a, b);
    if (!Number.isFinite(d)) {
      return { ok: false, reason: 'invalid_segment' as const, index: i };
    }
    if (d > maxSegmentM) {
      return {
        ok: false,
        reason: 'segment_too_long' as const,
        index: i,
        distanceMeters: d,
        maxSegmentM,
      };
    }
  }
  return { ok: true as const };
}

export function parsePointInput(
  input: unknown,
  precisionDecimals = DEFAULT_PRECISION_DECIMALS,
): LatLng | null {
  if (input == null) return null;

  if (typeof input === 'object' && !Array.isArray(input)) {
    const obj = input as Record<string, unknown>;
    const maybeLatitude = obj.latitude ?? obj.lat;
    const maybeLongitude = obj.longitude ?? obj.lon ?? obj.lng;
    const latN = Number(maybeLatitude);
    const lngN = Number(maybeLongitude);
    if (
      Number.isFinite(latN) &&
      Number.isFinite(lngN) &&
      isValidLat(latN) &&
      isValidLon(lngN)
    ) {
      return {
        lat: roundCoord(latN, precisionDecimals),
        lng: roundCoord(lngN, precisionDecimals),
      };
    }

    const maybeLatitude2 = obj.lng;
    const maybeLongitude2 = obj.lat;
    const lat2 = Number(maybeLatitude2);
    const lng2 = Number(maybeLongitude2);
    if (
      Number.isFinite(lat2) &&
      Number.isFinite(lng2) &&
      isValidLat(lat2) &&
      isValidLon(lng2)
    ) {
      return {
        lat: roundCoord(lat2, precisionDecimals),
        lng: roundCoord(lng2, precisionDecimals),
      };
    }
    return null;
  }

  if (typeof input === 'string') {
    const s = input.trim();
    try {
      const maybe = extractCoords(s);
      if (maybe && Number.isFinite(maybe.lat) && Number.isFinite(maybe.lng)) {
        return {
          lat: roundCoord(maybe.lat, precisionDecimals),
          lng: roundCoord(maybe.lng, precisionDecimals),
        };
      }
    } catch {
      // Игнорируем ошибки экстрактора и продолжаем fallback-парсинг.
    }

    if (s.startsWith('{') && s.endsWith('}')) {
      try {
        const parsed = JSON.parse(s);
        return parsePointInput(parsed, precisionDecimals);
      } catch {
        // continue
      }
    }

    const parts = s.split(',').map((x) => x.trim());
    if (parts.length === 2) {
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        if (isValidLon(a) && isValidLat(b)) {
          return {
            lat: roundCoord(b, precisionDecimals),
            lng: roundCoord(a, precisionDecimals),
          };
        }
        if (isValidLat(a) && isValidLon(b)) {
          return {
            lat: roundCoord(a, precisionDecimals),
            lng: roundCoord(b, precisionDecimals),
          };
        }
      }
    }

    return null;
  }

  if (Array.isArray(input) && input.length >= 2) {
    const a = Number(input[0]);
    const b = Number(input[1]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      if (isValidLat(a) && isValidLon(b)) {
        return {
          lat: roundCoord(a, precisionDecimals),
          lng: roundCoord(b, precisionDecimals),
        };
      }
      if (isValidLon(a) && isValidLat(b)) {
        return {
          lat: roundCoord(b, precisionDecimals),
          lng: roundCoord(a, precisionDecimals),
        };
      }
    }
    return null;
  }

  return null;
}

export function latLngToLonLat(
  input: LatLng | [number, number],
): [number, number] {
  if (Array.isArray(input)) {
    return [Number(input[0]), Number(input[1])];
  }
  return [Number(input.lng), Number(input.lat)];
}
