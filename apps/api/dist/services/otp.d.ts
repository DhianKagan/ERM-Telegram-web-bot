export interface CodeEntry {
    code: string;
    ts: number;
}
export declare const codes: Map<string, CodeEntry>;
export declare const attempts: Map<string, {
    count: number;
    ts: number;
}>;
export declare const adminCodes: Map<string, CodeEntry>;
export declare const adminAttempts: Map<string, {
    count: number;
    ts: number;
}>;
export interface SendCodePayload {
    telegramId: number;
}
export declare function sendCode({ telegramId }: SendCodePayload): Promise<void>;
export declare function sendManagerCode({ telegramId, }: SendCodePayload): Promise<void>;
export declare function sendAdminCode({ telegramId, }: SendCodePayload): Promise<void>;
export interface VerifyPayload {
    telegramId: number;
    code: string;
}
export declare function verifyCode({ telegramId, code }: VerifyPayload): boolean;
export declare function verifyAdminCode({ telegramId, code }: VerifyPayload): boolean;
