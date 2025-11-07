import type { RequestHandler } from 'express';
interface RateLimitOptions {
    windowMs: number;
    max: number;
    name: string;
    adminMax?: number;
    captcha?: boolean;
}
export default function createRateLimiter({ windowMs, max, name, adminMax, captcha, }: RateLimitOptions): RequestHandler;
export {};
