import type { CollectionFilters } from '../db/repos/collectionRepo';
export interface AggregatedCollectionItem {
    _id: string;
    type: string;
    name: string;
    value: string;
    meta?: Record<string, unknown>;
}
export declare function listCollectionsWithLegacy(filters?: CollectionFilters, page?: number, limit?: number): Promise<{
    items: AggregatedCollectionItem[];
    total: number;
}>;
declare const _default: {
    listCollectionsWithLegacy: typeof listCollectionsWithLegacy;
};
export default _default;
