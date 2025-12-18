// Назначение файла: установка cookie token
// Основные модули: express, config
import { Response, CookieOptions } from 'express';
import config from '../config';

function maskToken(token: string): string {
  if (!token) return '';
  const tail = token.slice(-4);
  return `***${tail}`;
}

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
  const preview = maskToken(token);
  console.info('Установлена cookie token', {
    token: preview,
    domain: cookieOpts.domain || 'none',
  });
}
