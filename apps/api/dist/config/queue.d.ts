export declare const queueConfig: {
    enabled: boolean;
    connection: {
        url: string;
    } | null;
    prefix: string;
    attempts: number;
    backoffMs: number;
    jobTimeoutMs: number;
    metricsIntervalMs: number;
};
export type QueueConfig = typeof queueConfig;
