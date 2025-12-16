export declare class CreateTaskDto {
    static rules(): import("express-validator").ValidationChain[];
}
export declare class UpdateTaskDto {
    static rules(): import("express-validator").ValidationChain[];
}
export declare class AddTimeDto {
    static rules(): import("express-validator").ValidationChain[];
}
export declare class BulkStatusDto {
    static rules(): import("express-validator").ValidationChain[];
}
declare const _default: {
    CreateTaskDto: typeof CreateTaskDto;
    UpdateTaskDto: typeof UpdateTaskDto;
    AddTimeDto: typeof AddTimeDto;
    BulkStatusDto: typeof BulkStatusDto;
};
export default _default;
