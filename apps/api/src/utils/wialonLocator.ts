// Назначение файла: утилиты для разбора ссылок Wialon
// Основные модули: URL

export interface LocatorLinkData {
  locatorUrl: string;
  baseUrl: string;
  locatorKey: string;
  token: string;
}

const DEFAULT_BASE_FALLBACK = 'https://hst-api.wialon.com';

function isPrintableAscii(value: string): boolean {
  return /^[\x20-\x7E]+$/.test(value);
}

function normalizeBase64(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (normalized.length % 4)) % 4;
  return normalized.padEnd(normalized.length + padding, '=');
}

function resolveBaseUrlFromLocator(url: URL, defaultBaseUrl?: string): string {
  const fallback = defaultBaseUrl || DEFAULT_BASE_FALLBACK;
  const { protocol, hostname, port } = url;
  if (!['http:', 'https:'].includes(protocol)) {
    throw new Error('Ссылка Wialon должна использовать http или https');
  }
  if (!hostname) {
    return fallback;
  }
  const mappedHost = hostname.startsWith('hosting.')
    ? hostname.replace(/^hosting\./, 'hst-api.')
    : hostname;
  const base = `${protocol}//${mappedHost}`;
  return port ? `${base}:${port}` : base;
}

export function decodeLocatorKey(locatorKey: string): string {
  const trimmed = locatorKey.trim();
  if (!trimmed) {
    throw new Error('Ключ локатора не может быть пустым');
  }
  if (!/^[A-Za-z0-9+/=_-]+$/.test(trimmed)) {
    throw new Error('Ключ локатора содержит недопустимые символы');
  }
  const normalized = normalizeBase64(trimmed);
  const buffer = Buffer.from(normalized, 'base64');
  if (buffer.length === 0) {
    throw new Error('Не удалось расшифровать ключ локатора');
  }
  const decoded = buffer.toString('utf8');
  if (!decoded.trim() || !isPrintableAscii(decoded)) {
    throw new Error('Расшифрованный ключ содержит недопустимые символы');
  }
  return decoded;
}

export function parseLocatorLink(link: string, defaultBaseUrl?: string): LocatorLinkData {
  if (typeof link !== 'string') {
    throw new Error('Ссылка на локатор должна быть строкой');
  }
  const trimmed = link.trim();
  if (!trimmed) {
    throw new Error('Ссылка на локатор не может быть пустой');
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Некорректная ссылка Wialon');
  }
  const locatorKey = url.searchParams.get('t');
  if (!locatorKey) {
    throw new Error('Ссылка Wialon должна содержать параметр t');
  }
  const token = decodeLocatorKey(locatorKey);
  const baseUrl = resolveBaseUrlFromLocator(url, defaultBaseUrl);
  return {
    locatorUrl: url.toString(),
    baseUrl,
    locatorKey,
    token,
  };
}

export const WIALON_BASE_FALLBACK = DEFAULT_BASE_FALLBACK;
