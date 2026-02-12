// apps/worker/src/utils/geo.ts
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

const resolvedPrecisionDecimals = Number(
  process.env.ROUTE_PRECISION_DECIMALS || String(DEFAULT_PRECISION_DECIMALS),
);
const precisionDecimals =
  Number.isFinite(resolvedPrecisionDecimals) && resolvedPrecisionDecimals >= 0
    ? resolvedPrecisionDecimals
    : DEFAULT_PRECISION_DECIMALS;

const resolvedMaxSegmentM = Number(
  process.env.ROUTE_MAX_SEGMENT_M || String(DEFAULT_MAX_SEGMENT_M),
);
export const MAX_SEGMENT_M =
  Number.isFinite(resolvedMaxSegmentM) && resolvedMaxSegmentM > 0
    ? resolvedMaxSegmentM
    : DEFAULT_MAX_SEGMENT_M;

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
