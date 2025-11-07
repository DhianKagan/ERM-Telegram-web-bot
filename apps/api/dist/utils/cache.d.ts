export declare function cacheGet<T>(key: string): Promise<T | undefined>;
export declare function cacheSet<T>(key: string, val: T, ttlSec?: number): Promise<void>;
export declare function cacheDel(key: string): Promise<void>;
export declare function cacheClear(): Promise<void>;
