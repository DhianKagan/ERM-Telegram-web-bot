// Назначение файла: утилита для разбора JWT
// Основные модули: web utils
export interface JwtPayload {
  [key: string]: unknown;
}

export default function parseJwt<T = JwtPayload>(token: string): T | null {
  try {
    const base = token.split('.')[1];
    const json = atob(base);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
