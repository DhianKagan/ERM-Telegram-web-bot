// Получение полной ссылки Google Maps и вспомогательные функции
// Модули: node.js fetch, dns/promises, net, shared
import { lookup } from 'dns/promises';
import net from 'net';
import {
  extractCoords,
  generateRouteLink,
  generateMultiRouteLink,
  type Coords as Coordinates,
} from 'shared';

const NOMINATIM_BASE_URL =
  process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
const NOMINATIM_DEFAULT_CONTACT =
  process.env.APP_URL && process.env.APP_URL.trim()
    ? process.env.APP_URL.trim()
    : 'https://erm.local/contact';
const NOMINATIM_USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ||
  `ERM-Telegram/1.0 (+${NOMINATIM_DEFAULT_CONTACT})`;
const NOMINATIM_CONTACT_EMAIL = process.env.NOMINATIM_CONTACT_EMAIL;
const NOMINATIM_MIN_INTERVAL_MS = Math.max(
  0,
  Number.parseInt(process.env.NOMINATIM_MIN_INTERVAL_MS || '', 10) || 1100,
);
const DEFAULT_ACCEPT_LANGUAGE = 'ru,en;q=0.9';

const MAPS_URL_PATTERNS = [
  /https:\/\/(?:www\.)?google\.[^"'\s<>]+/gi,
  /https:\/\/maps\.google\.[^"'\s<>]+/gi,
];

const decodeMapsUrlCandidate = (candidate: string): string | null => {
  if (!candidate) return null;
  let current = candidate.replace(/\\\//g, '/').replace(/\\u003d/gi, '=');
  current = current.replace(/\\u0026amp;/gi, '&amp;');
  current = current.replace(/\\u0026(?=[\w%.-]+=)/gi, '&');
  current = current.replace(/&amp;(?=[\w%.-]+=)/gi, '&');
  current = current.replace(/["']+$/g, '');
  try {
    const parsed = new URL(current);
    const host = parsed.hostname.toLowerCase();
    const isMapsHost =
      host === 'maps.google.com' ||
      host.startsWith('maps.google.') ||
      host.startsWith('www.google.');
    if (!isMapsHost) {
      return null;
    }
    if (
      host.startsWith('www.google.') &&
      !parsed.pathname.startsWith('/maps')
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

const hasCoordsInUrl = (value: string): boolean => {
  if (!value) return false;
  try {
    return extractCoords(value) !== null;
  } catch {
    return false;
  }
};

const findMapsUrlInBody = (body: string): string | null => {
  if (!body) return null;
  for (const pattern of MAPS_URL_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = body.match(pattern);
    if (!matches) continue;
    for (const raw of matches) {
      const decoded = decodeMapsUrlCandidate(raw);
      if (!decoded) continue;
      if (hasCoordsInUrl(decoded)) {
        return decoded;
      }
    }
  }
  return null;
};

const formatCoordinate = (value: number): string =>
  Number.isFinite(value) ? value.toFixed(6) : String(value);

const buildCoordsUrl = (coords: Coordinates): string =>
  `https://www.google.com/maps/@${formatCoordinate(coords.lat)},${formatCoordinate(
    coords.lng,
  )},17z`;

const STATIC_MAP_PATH = '/maps/api/staticmap';

const normalizeMapsUrl = (value: string): string => {
  if (!value) {
    return value;
  }
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const isGoogleHost =
      host === 'maps.google.com' ||
      host === 'maps.googleapis.com' ||
      host.endsWith('.google.com');
    if (!isGoogleHost) {
      return value;
    }
    const pathname = parsed.pathname.toLowerCase();
    if (!pathname.includes(STATIC_MAP_PATH)) {
      return value;
    }
    const coords = extractCoords(value);
    if (coords) {
      return buildCoordsUrl(coords);
    }
  } catch {
    // Игнорируем ошибки парсинга и возвращаем исходное значение.
  }
  return value;
};

export type { Coordinates };

export async function expandMapsUrl(shortUrl: string): Promise<string> {
  // Развёртывает короткий URL Google Maps с проверкой домена и протокола
  const allowedHosts = [
    'goo.gl',
    'maps.app.goo.gl',
    'maps.google.com',
    'www.google.com',
  ];
  let urlObj: URL;

  try {
    urlObj = new URL(shortUrl);
  } catch {
    throw new Error('Некорректный URL');
  }

  if (urlObj.protocol !== 'https:') {
    throw new Error('Недопустимый протокол URL');
  }

  if (urlObj.username || urlObj.password) {
    throw new Error('URL не должен содержать userinfo');
  }

  if (urlObj.port && urlObj.port !== '' && urlObj.port !== '443') {
    throw new Error('Недопустимый порт URL');
  }

  if (!allowedHosts.includes(urlObj.hostname)) {
    throw new Error('Недопустимый домен URL');
  }

  // Митигируем SSRF: разрешаем домен и проверяем IP-адреса
  let addresses;
  try {
    addresses = await lookup(urlObj.hostname, { all: true });
  } catch {
    throw new Error('Не удалось разрешить домен URL');
  }
  if (!addresses || addresses.length === 0) {
    throw new Error('Не удалось разрешить домен URL');
  }
  for (const addr of addresses) {
    if (isPrivateIp(addr.address)) {
      throw new Error('Домен URL разрешается во внутренний или запрещённый IP');
    }
  }

  const res = await fetch(urlObj.toString(), { redirect: 'follow' });
  const finalUrl = normalizeMapsUrl(res.url || urlObj.toString());
  if (hasCoordsInUrl(finalUrl)) {
    return finalUrl;
  }

  if (typeof (res as { text?: () => Promise<string> }).text === 'function') {
    try {
      const body = await (res as { text: () => Promise<string> }).text();
      const candidate = findMapsUrlInBody(body);
      const fallbackUrl = candidate ? normalizeMapsUrl(candidate) : null;
      if (fallbackUrl) {
        return fallbackUrl;
      }
      const coords = extractCoords(body);
      if (coords) {
        return buildCoordsUrl(coords);
      }
    } catch {
      // Игнорируем ошибки чтения тела, вернём исходный URL ниже
    }
  }

  return finalUrl;
}

// Проверка, что IP-адрес не является внутренним, loopback или link-local
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    // 10.0.0.0/8
    if (ip.startsWith('10.')) return true;
    // 172.16.0.0/12
    const [first, second] = ip.split('.').map((n) => parseInt(n, 10));
    if (first === 172 && second >= 16 && second <= 31) return true;
    // 192.168.0.0/16
    if (ip.startsWith('192.168.')) return true;
    // 127.0.0.0/8
    if (ip.startsWith('127.')) return true;
    // 169.254.0.0/16 (link-local)
    if (ip.startsWith('169.254.')) return true;
  } else if (net.isIPv6(ip)) {
    // ::1/128 (loopback)
    if (ip === '::1') return true;
    // fc00::/7 (unique local address)
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
    // fe80::/10 (link-local)
    if (ip.startsWith('fe80')) return true;
  }
  return false;
}

type NominatimSearchItem = {
  place_id?: number | string;
  display_name?: string;
  lat?: string;
  lon?: string;
  lng?: string;
};

type NominatimReverseResponse = {
  place_id?: number | string;
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: Record<string, string>;
};

export type NominatimPlace = {
  id: string;
  label: string;
  description?: string;
  lat: number;
  lng: number;
  source: 'nominatim';
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    if (ms > 0) {
      setTimeout(resolve, ms);
    } else {
      resolve();
    }
  });

let lastNominatimCall = 0;
let nominatimQueue: Promise<void> = Promise.resolve();

const scheduleNominatim = <T>(task: () => Promise<T>): Promise<T> => {
  const run = async () => {
    const now = Date.now();
    const wait = Math.max(
      0,
      NOMINATIM_MIN_INTERVAL_MS - (now - lastNominatimCall),
    );
    if (wait > 0) {
      await delay(wait);
    }
    try {
      return await task();
    } finally {
      lastNominatimCall = Date.now();
    }
  };
  const result = nominatimQueue.then(run, run);
  nominatimQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
};

const buildNominatimHeaders = (language?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'User-Agent': NOMINATIM_USER_AGENT,
    Accept: 'application/json',
  };
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    headers.Referer = appUrl;
  }
  if (language && language.trim()) {
    headers['Accept-Language'] =
      language
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .slice(0, 5)
        .join(',') || DEFAULT_ACCEPT_LANGUAGE;
  } else {
    headers['Accept-Language'] = DEFAULT_ACCEPT_LANGUAGE;
  }
  return headers;
};

const requestNominatim = async <T>(
  endpoint: string,
  params: Record<string, string>,
  language?: string,
): Promise<T | null> => {
  const url = new URL(endpoint, NOMINATIM_BASE_URL);
  url.searchParams.set('format', 'jsonv2');
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });
  if (NOMINATIM_CONTACT_EMAIL) {
    url.searchParams.set('email', NOMINATIM_CONTACT_EMAIL);
  }
  try {
    return await scheduleNominatim(async () => {
      const res = await fetch(url.toString(), {
        headers: buildNominatimHeaders(language),
      });
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error('Nominatim rate limit exceeded');
        }
        return null;
      }
      return (await res.json()) as T;
    });
  } catch (error) {
    console.error('Не удалось выполнить запрос к Nominatim', error);
    return null;
  }
};

const normalizeDisplayName = (
  displayName: string | undefined,
): { label: string; description?: string } | null => {
  if (!displayName) {
    return null;
  }
  const parts = displayName
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return null;
  }
  const [label, ...rest] = parts;
  return {
    label,
    description: rest.length ? rest.join(', ') : undefined,
  };
};

const normalizeNominatimItem = (
  item: NominatimSearchItem | NominatimReverseResponse,
): NominatimPlace | null => {
  const lat = item.lat ? Number.parseFloat(item.lat) : Number.NaN;
  const lonCandidate = 'lon' in item ? item.lon : undefined;
  const lngCandidate = 'lng' in item ? item.lng : undefined;
  const lngValue = lonCandidate ?? lngCandidate;
  const lng = lngValue ? Number.parseFloat(lngValue) : Number.NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  const normalized = normalizeDisplayName(item.display_name);
  if (!normalized) {
    return {
      id: String(item.place_id ?? `${lat},${lng}`),
      label: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      lat,
      lng,
      source: 'nominatim',
    };
  }
  return {
    id: String(item.place_id ?? `${lat},${lng}`),
    label: normalized.label,
    description: normalized.description,
    lat,
    lng,
    source: 'nominatim',
  };
};

export const searchAddress = async (
  query: string,
  options: { limit?: number; language?: string } = {},
): Promise<NominatimPlace[]> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 10);
  const response = await requestNominatim<NominatimSearchItem[]>(
    '/search',
    {
      q: trimmed,
      limit: String(limit),
      addressdetails: '1',
    },
    options.language,
  );
  if (!response || !Array.isArray(response)) {
    return [];
  }
  return response
    .map((item) => normalizeNominatimItem(item))
    .filter((item): item is NominatimPlace => Boolean(item));
};

export const reverseGeocode = async (
  coords: Coordinates,
  options: { language?: string } = {},
): Promise<NominatimPlace | null> => {
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
    return null;
  }
  const response = await requestNominatim<NominatimReverseResponse>(
    '/reverse',
    {
      lat: coords.lat.toString(),
      lon: coords.lng.toString(),
      addressdetails: '1',
    },
    options.language,
  );
  if (!response) {
    return null;
  }
  return normalizeNominatimItem({
    place_id: response.place_id,
    display_name: response.display_name,
    lat: response.lat,
    lon: response.lon,
  });
};

const maps = {
  expandMapsUrl,
  extractCoords,
  generateRouteLink,
  generateMultiRouteLink,
  searchAddress,
  reverseGeocode,
};

export default maps;

export { extractCoords, generateRouteLink, generateMultiRouteLink };
