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

function normalizeLocatorKeyValue(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const MAX_JSON_DEPTH = 5;

function extractLocatorKeyFromJson(
  value: unknown,
  keys: string[],
  depth = 0,
): string | null {
  if (depth > MAX_JSON_DEPTH || value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractLocatorKeyFromJson(item, keys, depth + 1);
      if (extracted) {
        return extracted;
      }
    }
    return null;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const [entryKey, entryValue] of Object.entries(record)) {
      if (typeof entryKey === 'string') {
        const normalizedKey = entryKey.toLowerCase();
        if (keys.includes(entryKey) || keys.includes(normalizedKey)) {
          if (typeof entryValue === 'string') {
            const normalized = normalizeLocatorKeyValue(entryValue);
            if (normalized) {
              return normalized;
            }
          }
        }
      }
    }
    for (const entry of Object.values(record)) {
      const extracted = extractLocatorKeyFromJson(entry, keys, depth + 1);
      if (extracted) {
        return extracted;
      }
    }
    return null;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return extractLocatorKeyFromJson(parsed, keys, depth + 1);
    } catch {
      return null;
    }
  }
  return null;
}

function extractLocatorKeyFromComponent(component: string, keys: string[]): string | null {
  if (!component) {
    return null;
  }
  const trimmed = component.trim();
  if (!trimmed) {
    return null;
  }
  let normalized = trimmed.replace(/^[?#]/, '');
  if (!normalized) {
    return null;
  }
  const queryIndex = normalized.indexOf('?');
  if (queryIndex >= 0) {
    const equalsIndex = normalized.indexOf('=');
    if (equalsIndex === -1 || queryIndex < equalsIndex) {
      normalized = normalized.slice(queryIndex + 1);
    }
  }
  normalized = normalized.replace(/^\/+/, '');
  if (!normalized) {
    return null;
  }
  const pairs = normalized.split('&').filter(Boolean);
  const jsonCandidates: string[] = [];
  if (pairs.length === 0) {
    return null;
  }
  for (const key of keys) {
    for (const pair of pairs) {
      const [rawName, ...rawValueParts] = pair.split('=');
      if (!rawName) {
        jsonCandidates.push(pair);
        continue;
      }
      let name: string;
      try {
        name = decodeURIComponent(rawName);
      } catch {
        jsonCandidates.push(pair);
        continue;
      }
      const normalizedName = name.toLowerCase();
      if (normalizedName !== key) {
        if (!rawValueParts.length) {
          jsonCandidates.push(pair);
        }
        continue;
      }
      const rawValue = rawValueParts.join('=');
      let value: string;
      try {
        value = decodeURIComponent(rawValue);
      } catch {
        throw new Error('Ключ локатора содержит недопустимые символы');
      }
      const normalizedValue = normalizeLocatorKeyValue(value);
      if (!normalizedValue) {
        continue;
      }
      return normalizedValue;
    }
  }
  const sourcesToCheck = new Set<string>([normalized, ...jsonCandidates]);
  for (const source of sourcesToCheck) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(source);
    } catch {
      continue;
    }
    const extracted = extractLocatorKeyFromJson(decoded, keys);
    if (extracted) {
      return extracted;
    }
  }
  return null;
}

function resolveLocatorKey(url: URL): string | null {
  const keys = ['t', 'token'];
  const normalizedKeys = keys.map((key) => key.toLowerCase());
  const fromSearch = extractLocatorKeyFromComponent(url.search, normalizedKeys);
  if (fromSearch) {
    return fromSearch;
  }
  return extractLocatorKeyFromComponent(url.hash, normalizedKeys);
}

// Обработка локатора поддерживает «сырые» токены, не прошедшие base64-декодирование;
// fallback срабатывает, если декодирование возвращает управляющие символы,
// символ подстановки U+FFFD или результат не совпадает с исходным ключом после повторного кодирования.
export interface DecodeLocatorKeyResult {
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

export function decodeLocatorKeyDetailed(
  locatorKey: string,
): DecodeLocatorKeyResult {
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
  const locatorKey = resolveLocatorKey(url);
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
