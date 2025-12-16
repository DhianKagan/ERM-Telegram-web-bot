import { QueueName } from 'shared';
export type StackCheckStatus = 'ok' | 'warn' | 'error';
export type StackCheckResult = {
    name: string;
    status: StackCheckStatus;
    durationMs?: number;
    message?: string;
    meta?: Record<string, unknown>;
};
export type StackHealthReport = {
    ok: boolean;
    timestamp: string;
    results: StackCheckResult[];
};
type StackHealthOptions = {
    proxyUrl?: string;
    proxySource?: string;
    proxyToken?: string;
    redisUrl?: string;
    queuePrefix?: string;
    queueNames?: QueueName[];
};
export default class StackHealthService {
    checkProxy(options: {
        proxyUrl?: string;
        proxySource?: string;
        proxyToken?: string;
    }): Promise<StackCheckResult>;
    checkRedis(options: {
        redisUrl?: string;
        queuePrefix?: string;
        queueNames: QueueName[];
    }): Promise<StackCheckResult>;
    checkMongo(): Promise<StackCheckResult>;
    run(options: StackHealthOptions): Promise<StackHealthReport>;
}
export {};
