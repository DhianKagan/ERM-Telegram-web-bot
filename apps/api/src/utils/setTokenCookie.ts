// Назначение файла: установка cookie token
// Основные модули: express, config
import { Response, CookieOptions } from 'express';
import config from '../config';

export const buildTokenCookieOptions = (
  cfg = config,
  maxAge = 7 * 24 * 60 * 60 * 1000,
): CookieOptions => {
  const secure =
    process.env.COOKIE_SECURE === undefined
      ? process.env.NODE_ENV === 'production'
      : process.env.COOKIE_SECURE !== 'false';
  const options: CookieOptions = {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    maxAge,
  };
  if (secure && process.env.NODE_ENV === 'production') {
    options.domain = cfg.cookieDomain || new URL(cfg.appUrl).hostname;
  }
  return options;
};

export default function setTokenCookie(
  res: Response,
  token: string,
  cfg = config,
): void {
  const cookieOpts = buildTokenCookieOptions(cfg);
  res.cookie('token', token, cookieOpts);
}
