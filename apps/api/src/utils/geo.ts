// apps/api/src/utils/geo.ts
import {
  DEFAULT_MAX_SEGMENT_M,
  DEFAULT_PRECISION_DECIMALS,
  haversineDistanceMeters as sharedHaversineDistanceMeters,
  latLngToLonLat as sharedLatLngToLonLat,
  normalizePointsString as sharedNormalizePointsString,
  parsePointInput as sharedParsePointInput,
  precheckLocations as sharedPrecheckLocations,
  type LatLng,
  type LonLatPair,
} from 'shared';

export type { LatLng, LonLatPair };

let precisionDecimals = Number(
  process.env.ROUTE_PRECISION_DECIMALS || String(DEFAULT_PRECISION_DECIMALS),
);
if (!Number.isFinite(precisionDecimals) || precisionDecimals < 0) {
  console.warn(
    'ROUTE_PRECISION_DECIMALS должен быть неотрицательным числом. Используется значение по умолчанию 6',
  );
  precisionDecimals = DEFAULT_PRECISION_DECIMALS;
}

let maxSegmentM = Number(
  process.env.ROUTE_MAX_SEGMENT_M || String(DEFAULT_MAX_SEGMENT_M),
);
if (!Number.isFinite(maxSegmentM) || maxSegmentM <= 0) {
  console.warn(
    'ROUTE_MAX_SEGMENT_M должен быть положительным числом. Используется значение по умолчанию 200000',
  );
  maxSegmentM = DEFAULT_MAX_SEGMENT_M;
}

export const MAX_SEGMENT_M = maxSegmentM;

export function normalizePointsString(raw: string): LonLatPair[] {
  return sharedNormalizePointsString(raw, precisionDecimals);
}

export function haversineDistanceMeters(a: LonLatPair, b: LonLatPair): number {
  return sharedHaversineDistanceMeters(a, b);
}

export function precheckLocations(locations: LonLatPair[]) {
  return sharedPrecheckLocations(locations, MAX_SEGMENT_M);
}

export function parsePointInput(input: unknown): LatLng | null {
  return sharedParsePointInput(input, precisionDecimals);
}

export function latLngToLonLat(
  input: LatLng | [number, number],
): [number, number] {
  return sharedLatLngToLonLat(input);
}
