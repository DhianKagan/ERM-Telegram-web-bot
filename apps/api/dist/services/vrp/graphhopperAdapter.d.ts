export interface TravelMatrixOptions {
    averageSpeedKmph: number;
    signal?: AbortSignal;
    timeoutMs?: number;
}
export interface TravelMatrixResult {
    provider: 'graphhopper' | 'haversine';
    distanceMatrix: number[][];
    timeMatrix: number[][];
    warnings: string[];
}
type GraphhopperFetcher = (input: string, init: RequestInit) => Promise<Response>;
export declare function buildTravelMatrix(points: Array<{
    lat: number;
    lng: number;
}>, options: TravelMatrixOptions): Promise<TravelMatrixResult>;
export declare const __testing: {
    setFetcher(fetcher: GraphhopperFetcher | undefined): void;
};
export {};
