type GeocoderProvider = 'nominatim' | 'openrouteservice';
export declare const workerConfig: {
    readonly connection: {
        url: string;
    };
    readonly prefix: string;
    readonly attempts: number;
    readonly backoffMs: number;
    readonly concurrency: number;
    readonly geocoder: {
        readonly enabled: boolean;
        readonly baseUrl: string;
        readonly userAgent: string;
        readonly email: string | undefined;
        readonly apiKey: string | undefined;
        readonly proxyToken: string | undefined;
        readonly provider: GeocoderProvider;
    };
    readonly routing: {
        readonly enabled: boolean;
        readonly baseUrl: string | undefined;
        readonly algorithm: string | undefined;
        readonly proxyToken: string | undefined;
    };
};
export type WorkerConfig = typeof workerConfig;
export {};
