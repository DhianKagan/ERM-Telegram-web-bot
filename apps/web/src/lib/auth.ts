/* eslint-env browser */

let accessToken: string | null = null;

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

export const setAccessToken = (token: string | null | undefined): void => {
  accessToken = token ? token.trim() : null;
};

export const clearAccessToken = (): void => {
  accessToken = null;
};

export default {
  shouldUseBearerAuth,
  getAccessToken,
  setAccessToken,
  clearAccessToken,
};
