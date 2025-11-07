import { Types } from 'mongoose';
import { CollectionItemDocument, CollectionItemAttrs } from '../models/CollectionItem';
export interface CollectionFilters {
    type?: string;
    name?: string;
    value?: string;
    search?: string;
}
export declare function create(data: CollectionItemAttrs & {
    _id?: Types.ObjectId | string;
}): Promise<CollectionItemDocument>;
export declare function list(filters?: CollectionFilters, page?: number, limit?: number): Promise<{
    items: CollectionItemDocument[];
    total: number;
}>;
export declare function update(id: string, data: Partial<CollectionItemAttrs>): Promise<CollectionItemDocument | null>;
export declare function remove(id: string): Promise<CollectionItemDocument | null>;
declare const _default: {
    create: typeof create;
    list: typeof list;
    update: typeof update;
    remove: typeof remove;
};
export default _default;
