export declare const ACCESS_USER = 1;
export declare const ACCESS_ADMIN = 2;
export declare const ACCESS_MANAGER = 4;
export declare const ACCESS_TASK_DELETE = 8;
export declare function hasAccess(mask: number, required: number): boolean;
