import { Document, Types } from 'mongoose';
export interface EmployeeAttrs {
    departmentId: Types.ObjectId;
    divisionId?: Types.ObjectId;
    positionId?: Types.ObjectId;
    name: string;
}
export interface EmployeeDocument extends EmployeeAttrs, Document {
}
export declare const Employee: import("mongoose").Model<EmployeeDocument, {}, {}, {}, Document<unknown, {}, EmployeeDocument, {}, {}> & EmployeeDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
