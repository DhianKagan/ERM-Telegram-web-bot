// Назначение файла: установка cookie token
// Основные модули: express, config
import { Response, CookieOptions } from 'express';
import config from '../config';

export default function setTokenCookie(
  res: Response,
  token: string,
  cfg = config,
): void {
  const secure = process.env.NODE_ENV === 'production';
  const cookieOpts: CookieOptions = {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
  if (secure) {
    cookieOpts.domain = cfg.cookieDomain || new URL(cfg.appUrl).hostname;
  }
  res.cookie('token', token, cookieOpts);
  const preview = token.slice(0, 8);
  console.log(
    `Установлена cookie token:${preview} domain:${cookieOpts.domain || 'none'}`,
  );
}

// Совместимость с CommonJS
(module as any).exports = setTokenCookie;
