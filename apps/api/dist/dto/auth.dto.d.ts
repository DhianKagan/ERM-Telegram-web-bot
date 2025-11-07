export declare class SendCodeDto {
    static rules(): import("express-validator").ValidationChain[];
}
export declare class VerifyCodeDto {
    static rules(): import("express-validator").ValidationChain[];
}
export declare class VerifyInitDto {
    static rules(): import("express-validator").ValidationChain[];
}
export declare class UpdateProfileDto {
    static rules(): import("express-validator").ValidationChain[];
}
declare const _default: {
    SendCodeDto: typeof SendCodeDto;
    VerifyCodeDto: typeof VerifyCodeDto;
    VerifyInitDto: typeof VerifyInitDto;
    UpdateProfileDto: typeof UpdateProfileDto;
};
export default _default;
