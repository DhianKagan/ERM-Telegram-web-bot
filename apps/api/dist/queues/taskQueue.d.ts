import { Queue, QueueEvents } from 'bullmq';
import { QueueName, type Coordinates, type GeocodingJobResult, type RouteDistanceJobResult } from 'shared';
type QueueBundle = {
    queue: Queue;
    events: QueueEvents;
};
export declare const getQueueBundle: (queueName: QueueName) => QueueBundle | null;
export declare const requestGeocodingJob: (address: string) => Promise<GeocodingJobResult>;
export type RequestRouteDistanceParams = {
    start: Coordinates;
    finish: Coordinates;
};
export type RequestRouteDistanceContext = {
    traceparent?: string;
};
export declare const requestRouteDistanceJob: (params: RequestRouteDistanceParams, context?: RequestRouteDistanceContext) => Promise<RouteDistanceJobResult>;
export {};
