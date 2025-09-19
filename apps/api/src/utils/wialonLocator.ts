// Назначение файла: утилиты для разбора ссылок Wialon
// Основные модули: URL

export interface LocatorLinkData {
  locatorUrl: string;
  baseUrl: string;
  locatorKey: string;
  token: string;
}

const DEFAULT_BASE_FALLBACK = 'https://hst-api.wialon.com';
const BASE64_KEY_PATTERN = /^[A-Za-z0-9+/=_-]+$/;
const RAW_KEY_PATTERN = /^[0-9A-Za-z._:+/@=~-]+$/;
const REPLACEMENT_CHAR = '\uFFFD';

// Обработка локатора поддерживает «сырые» токены, не прошедшие base64-декодирование;
// fallback срабатывает, если декодирование возвращает управляющие символы,
// символ подстановки U+FFFD или результат не совпадает с исходным ключом после повторного кодирования.
interface DecodeLocatorKeyResult {
  token: string;
  fallback: boolean;
}

function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0);
    if (code !== undefined && (code < 0x20 || (code >= 0x7f && code <= 0x9f))) {
      return true;
    }
  }
  return false;
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

function decodeLocatorKeyDetailed(locatorKey: string): DecodeLocatorKeyResult {
  const trimmed = locatorKey.trim();
  if (!trimmed) {
    throw new Error('Ключ локатора не может быть пустым');
  }
  const isBase64Candidate = BASE64_KEY_PATTERN.test(trimmed);
  const isRawCandidate = RAW_KEY_PATTERN.test(trimmed);
  if (!isBase64Candidate && !isRawCandidate) {
    throw new Error('Ключ локатора содержит недопустимые символы');
  }
  if (!isBase64Candidate) {
    if (hasControlCharacters(trimmed)) {
      throw new Error('Ключ локатора содержит недопустимые символы');
    }
    return { token: trimmed, fallback: true };
  }
  try {
    const normalized = normalizeBase64(trimmed);
    const buffer = Buffer.from(normalized, 'base64');
    if (buffer.length === 0) {
      throw new Error('Не удалось расшифровать ключ локатора');
    }
    const decoded = buffer.toString('utf8');
    const reEncoded = Buffer.from(decoded, 'utf8').toString('base64');
    const normalizedReEncoded = normalizeBase64(reEncoded);
    const hasReplacementChar = decoded.includes(REPLACEMENT_CHAR);
    const normalizedToken = decoded.trim();
    const isConsistent = normalizedReEncoded === normalized;
    if (
      !normalizedToken ||
      hasControlCharacters(normalizedToken) ||
      hasReplacementChar ||
      !isConsistent
    ) {
      if (isRawCandidate && !hasControlCharacters(trimmed)) {
        return { token: trimmed, fallback: true };
      }
      throw new Error('Расшифрованный ключ содержит недопустимые символы');
    }
    return { token: normalizedToken, fallback: false };
  } catch (error) {
    if (isRawCandidate && !hasControlCharacters(trimmed)) {
      return { token: trimmed, fallback: true };
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export function decodeLocatorKey(locatorKey: string): string {
  return decodeLocatorKeyDetailed(locatorKey).token;
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
  const { token } = decodeLocatorKeyDetailed(locatorKey);
  const baseUrl = resolveBaseUrlFromLocator(url, defaultBaseUrl);
  return {
    locatorUrl: url.toString(),
    baseUrl,
    locatorKey,
    token,
  };
}

export const WIALON_BASE_FALLBACK = DEFAULT_BASE_FALLBACK;
