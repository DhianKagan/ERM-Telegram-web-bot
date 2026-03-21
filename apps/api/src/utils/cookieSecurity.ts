// Назначение файла: общие правила безопасности cookie (secure-режим, префиксы, host-only).
// Основные модули: отсутствуют

interface CookieSecurityOptions {
  secure: boolean;
  domain?: string;
  path?: string;
}

export const isSecureCookiesEnabled = (): boolean =>
  process.env.COOKIE_SECURE === undefined
    ? process.env.NODE_ENV === 'production'
    : process.env.COOKIE_SECURE !== 'false';

export const resolveCookieName = (
  baseName: string,
  options: CookieSecurityOptions,
): string => {
  if (/^__(Secure|Host)-/u.test(baseName) || !options.secure) {
    return baseName;
  }

  if (!options.domain && (options.path || '/') === '/') {
    return `__Host-${baseName}`;
  }

  return `__Secure-${baseName}`;
};
