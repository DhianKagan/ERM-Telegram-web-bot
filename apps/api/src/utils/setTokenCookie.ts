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
  console.info('Установлена cookie token', {
    domain: cookieOpts.domain || 'none',
  });
}
