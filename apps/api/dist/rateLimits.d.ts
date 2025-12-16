export declare const rateLimits: {
    auth: {
        windowMs: number;
        max: number;
        adminMax: number;
        name: string;
        captcha: boolean;
    };
    route: {
        windowMs: number;
        max: number;
        adminMax: number;
        name: string;
    };
    table: {
        windowMs: number;
        max: number;
        adminMax: number;
        name: string;
    };
};
export default rateLimits;
