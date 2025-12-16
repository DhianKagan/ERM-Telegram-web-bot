import { Request, Response } from 'express';
type DependencyStatus = 'up' | 'down';
type MongoHealth = {
    status: DependencyStatus;
    latencyMs?: number;
    message?: string;
};
export type HealthPayload = {
    status: 'ok' | 'error';
    timestamp: string;
    checks: {
        mongo: MongoHealth;
    };
};
export declare function checkMongoHealth(): Promise<MongoHealth>;
export declare function collectHealthStatus(): Promise<HealthPayload>;
export default function healthcheck(_req: Request, res: Response): Promise<void>;
export {};
