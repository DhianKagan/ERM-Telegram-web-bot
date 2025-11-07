import { type Logger } from 'pino';
export interface ListLogParams {
    level?: string;
    message?: string;
    from?: string;
    to?: string;
    traceId?: string;
    sort?: string;
    page?: number;
    limit?: number;
}
export interface BufferedLogEntry {
    id: string;
    createdAt: string;
    time: string;
    level: LogLevel;
    message: string;
    traceId?: string;
    metadata?: Record<string, unknown>;
}
type AllowedLevels = 'debug' | 'info' | 'warn' | 'error' | 'log';
type LogLevel = AllowedLevels;
declare const logger: Logger;
declare let writeLogFn: (message: string, level?: string, metadata?: Record<string, unknown>) => Promise<void>;
declare let listLogsFn: (params?: ListLogParams) => Promise<BufferedLogEntry[]>;
export { logger, writeLogFn as writeLog, listLogsFn as listLogs };
