// Назначение файла: установка cookie token
// Основные модули: express, config
import { Response, CookieOptions } from 'express';
import config from '../config';
import { isSecureCookiesEnabled } from './cookieSecurity';

export const buildTokenCookieOptions = (
  cfg = config,
  maxAge = 7 * 24 * 60 * 60 * 1000,
): CookieOptions => {
  const secure = isSecureCookiesEnabled();
  const options: CookieOptions = {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    maxAge,
  };
  if (secure && process.env.NODE_ENV === 'production' && cfg.cookieDomain) {
    options.domain = cfg.cookieDomain;
  }
  return options;
};

export const buildLegacyTokenCookieOptions = (
  cfg = config,
  maxAge = 7 * 24 * 60 * 60 * 1000,
  path?: string,
): CookieOptions => {
  const secure = isSecureCookiesEnabled();
  const options: CookieOptions = {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    maxAge,
  };
  if (path) {
    options.path = path;
  }
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
