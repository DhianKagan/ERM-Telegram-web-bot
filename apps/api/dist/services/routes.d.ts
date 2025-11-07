export interface RoutesFilter {
    [key: string]: unknown;
}
export declare function list(filters: RoutesFilter): Promise<unknown>;
