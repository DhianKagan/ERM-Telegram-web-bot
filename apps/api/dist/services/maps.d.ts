import { extractCoords, generateRouteLink, generateMultiRouteLink, type Coords as Coordinates } from 'shared';
export type { Coordinates };
export declare function expandMapsUrl(shortUrl: string): Promise<string>;
export type NominatimPlace = {
    id: string;
    label: string;
    description?: string;
    lat: number;
    lng: number;
    source: 'nominatim';
};
export declare const searchAddress: (query: string, options?: {
    limit?: number;
    language?: string;
}) => Promise<NominatimPlace[]>;
export declare const reverseGeocode: (coords: Coordinates, options?: {
    language?: string;
}) => Promise<NominatimPlace | null>;
declare const maps: {
    expandMapsUrl: typeof expandMapsUrl;
    extractCoords: typeof extractCoords;
    generateRouteLink: typeof generateRouteLink;
    generateMultiRouteLink: typeof generateMultiRouteLink;
    searchAddress: (query: string, options?: {
        limit?: number;
        language?: string;
    }) => Promise<NominatimPlace[]>;
    reverseGeocode: (coords: Coordinates, options?: {
        language?: string;
    }) => Promise<NominatimPlace | null>;
};
export default maps;
export { extractCoords, generateRouteLink, generateMultiRouteLink };
