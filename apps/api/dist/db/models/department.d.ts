import { Document, Types } from 'mongoose';
export interface DepartmentAttrs {
    fleetId: Types.ObjectId;
    name: string;
}
export interface DepartmentDocument extends DepartmentAttrs, Document {
}
export declare const Department: import("mongoose").Model<DepartmentDocument, {}, {}, {}, Document<unknown, {}, DepartmentDocument, {}, {}> & DepartmentDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
