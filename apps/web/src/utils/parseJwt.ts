// Назначение файла: утилита для разбора JWT
// Основные модули: web utils
export interface JwtPayload {
  [key: string]: unknown;
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (base64.length % 4)) % 4;
  return atob(base64.padEnd(base64.length + padding, '='));
}

export default function parseJwt<T = JwtPayload>(token: string): T | null {
  try {
    if (!token) return null;
    const base = token.split('.')[1];
    if (!base) return null;
    const json = decodeBase64Url(base);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
