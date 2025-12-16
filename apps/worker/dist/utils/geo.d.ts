export type LatLng = {
    lat: number;
    lng: number;
};
export type LonLatPair = [number, number];
export declare const MAX_SEGMENT_M: number;
/**
 * Normalize points string "lon,lat;lon2,lat2;..." or with '|' separator.
 * Returns array of [lon, lat].
 */
export declare function normalizePointsString(raw: string): LonLatPair[];
/** Haversine — meters */
export declare function haversineDistanceMeters(a: LonLatPair, b: LonLatPair): number;
export declare function precheckLocations(locations: LonLatPair[]): {
    ok: boolean;
    reason: string;
    index?: undefined;
    distanceMeters?: undefined;
    maxSegmentM?: undefined;
} | {
    ok: boolean;
    reason: string;
    index: number;
    distanceMeters?: undefined;
    maxSegmentM?: undefined;
} | {
    ok: boolean;
    reason: string;
    index: number;
    distanceMeters: number;
    maxSegmentM: number;
} | {
    ok: boolean;
    reason?: undefined;
    index?: undefined;
    distanceMeters?: undefined;
    maxSegmentM?: undefined;
};
/**
 * Parse an incoming point value to a LatLng object or null.
 * Accepts:
 *  - object { lat:number, lng:number } or { lng, lat }
 *  - JSON strings like '{"lat":..,"lng":..}'
 *  - strings "lon,lat" or "lat,lng" (tries to detect)
 *  - array [lat,lng] or [lng,lat]
 *
 * Returns: {lat, lng} with numbers (rounded), or null if invalid.
 */
export declare function parsePointInput(input: unknown): LatLng | null;
/**
 * Convert lat/lng object to [lon, lat] array
 */
export declare function latLngToLonLat(input: LatLng | [number, number]): [number, number];
