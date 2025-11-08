import client from 'prom-client';
export declare const register: client.Registry;
export declare const httpRequestsTotal: client.Counter<"status" | "method" | "route">;
export declare const httpRequestDuration: client.Histogram<"status" | "method" | "route">;
export declare const osrmRequestDuration: client.Histogram<"status" | "endpoint">;
export declare const osrmErrorsTotal: client.Counter<"reason" | "endpoint">;
export declare const fleetRecoveryFailuresTotal: client.Counter<"reason">;
