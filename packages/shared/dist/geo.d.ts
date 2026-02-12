export type LatLng = {
  lat: number;
  lng: number;
};
export type LonLatPair = [number, number];
export declare const DEFAULT_PRECISION_DECIMALS = 6;
export declare const DEFAULT_MAX_SEGMENT_M = 200000;
export declare function roundCoord(value: number, decimals?: number): number;
export declare function isValidLat(lat: number): boolean;
export declare function isValidLon(lon: number): boolean;
export declare function normalizePointsString(
  raw: string,
  precisionDecimals?: number,
): LonLatPair[];
export declare function haversineDistanceMeters(
  a: LonLatPair,
  b: LonLatPair,
): number;
export declare function precheckLocations(
  locations: LonLatPair[],
  maxSegmentM?: number,
):
  | {
      ok: boolean;
      reason: 'too_few_points';
      index?: undefined;
      distanceMeters?: undefined;
      maxSegmentM?: undefined;
    }
  | {
      ok: boolean;
      reason: 'invalid_segment';
      index: number;
      distanceMeters?: undefined;
      maxSegmentM?: undefined;
    }
  | {
      ok: boolean;
      reason: 'segment_too_long';
      index: number;
      distanceMeters: number;
      maxSegmentM: number;
    }
  | {
      ok: true;
      reason?: undefined;
      index?: undefined;
      distanceMeters?: undefined;
      maxSegmentM?: undefined;
    };
export declare function parsePointInput(
  input: unknown,
  precisionDecimals?: number,
): LatLng | null;
export declare function latLngToLonLat(
  input: LatLng | [number, number],
): [number, number];
