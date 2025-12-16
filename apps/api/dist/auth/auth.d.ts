interface Payload {
    id: string | number;
    username: string;
    role: string;
    access: number;
}
export declare function generateToken(user: Payload): string;
export declare function generateShortToken(user: Payload): string;
export declare function refreshToken(token: string): string;
export {};
