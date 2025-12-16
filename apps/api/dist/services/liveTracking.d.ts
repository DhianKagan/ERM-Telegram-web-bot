import { EventEmitter } from 'node:events';
import type { TrackingEvent } from 'shared';
type TrackingListener = (event: TrackingEvent) => void;
export declare function publishTrackingEvent(event: TrackingEvent): void;
export declare function subscribeTrackingEvents(listener: TrackingListener): () => void;
export declare function getTrackingEmitter(): EventEmitter;
export {};
