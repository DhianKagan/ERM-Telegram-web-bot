interface TraceStore {
    traceId: string;
    traceparent: string;
}
export declare function runWithTrace<T>(store: TraceStore, fn: () => T): T;
export declare function getTrace(): TraceStore | undefined;
export {};
