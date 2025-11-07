import express from 'express';
import type { CookieOptions } from 'express-session';
export default function registerRoutes(app: express.Express, cookieFlags: CookieOptions, pub: string): Promise<void>;
