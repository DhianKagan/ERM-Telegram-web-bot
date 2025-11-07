import { Types } from 'mongoose';
export declare function resolveRoleId(name: string): Promise<Types.ObjectId | null>;
export declare function clearRoleCache(name?: string): void;
