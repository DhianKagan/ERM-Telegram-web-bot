/* eslint-env browser */

let accessToken: string | null = null;

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${escapedName}=([^;]*)`),
  );
  if (!match?.[1]) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const readEnv = (key: string): string | undefined => {
  const fromProcess =
    typeof process !== 'undefined' ? process.env?.[key] : undefined;
  if (fromProcess !== undefined) {
    return fromProcess;
  }
  return import.meta.env?.[key as keyof ImportMetaEnv] as string | undefined;
};

export const shouldUseBearerAuth = (): boolean => {
  const value = (readEnv('VITE_AUTH_BEARER_ENABLED') || '')
    .trim()
    .toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
};

export const getAccessToken = (): string | null => accessToken;

export const getAccessTokenFromCookie = (): string | null => {
  const tokenFromCookie = readCookie('token');
  if (!tokenFromCookie) {
    return null;
  }
  return tokenFromCookie.trim() || null;
};

export const setAccessToken = (token: string | null | undefined): void => {
  accessToken = token ? token.trim() : null;
};

export const clearAccessToken = (): void => {
  accessToken = null;
};

export default {
  shouldUseBearerAuth,
  getAccessToken,
  getAccessTokenFromCookie,
  setAccessToken,
  clearAccessToken,
};
