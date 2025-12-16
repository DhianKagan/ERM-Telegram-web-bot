import type { Coordinates, RouteDistanceJobResult } from 'shared';
import type { WorkerConfig } from '../config';
export declare const calculateRouteDistance: (startRaw: Coordinates, finishRaw: Coordinates, config: WorkerConfig["routing"]) => Promise<RouteDistanceJobResult>;
