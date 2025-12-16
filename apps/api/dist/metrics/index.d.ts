import client from 'prom-client';
export declare const register: client.Registry;
export declare const httpRequestsTotal: client.Counter<"route" | "method" | "status">;
export declare const httpRequestDuration: client.Histogram<"route" | "method" | "status">;
export declare const osrmRequestDuration: client.Histogram<"status" | "endpoint">;
export declare const osrmErrorsTotal: client.Counter<"reason" | "endpoint">;
export declare const fleetRecoveryFailuresTotal: client.Counter<"reason">;
