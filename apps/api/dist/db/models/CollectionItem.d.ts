import { Document, Types } from 'mongoose';
export interface CollectionItemMeta {
    invalid?: boolean;
    invalidReason?: string;
    invalidCode?: string;
    invalidAt?: Date;
    [key: string]: unknown;
}
export interface CollectionItemAttrs {
    type: string;
    name: string;
    value: string;
    meta?: CollectionItemMeta;
}
export interface CollectionItemDocument extends Document<Types.ObjectId, Record<string, never>, CollectionItemAttrs>, CollectionItemAttrs {
}
export declare const CollectionItem: import("mongoose").Model<CollectionItemDocument, {}, {}, {}, Document<unknown, {}, CollectionItemDocument, {}, {}> & CollectionItemDocument & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
