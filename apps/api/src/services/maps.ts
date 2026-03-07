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
  /https:\\\/\\\/(?:www\.)?google\.[^"'\s<>]+/gi,
  /https:\\\/\\\/maps\.google\.[^"'\s<>]+/gi,
  /https:\\u002[fF]\\u002[fF](?:www\.)?google\.[^"'\s<>]+/gi,
  /https:\\u002[fF]\\u002[fF]maps\.google\.[^"'\s<>]+/gi,
];

const ALLOWED_MAPS_HOSTS = new Set([
  'goo.gl',
  'maps.app.goo.gl',
  'google.com',
  'maps.google.com',
  'www.google.com',
]);

const isAllowedMapsHost = (host: string): boolean => {
  if (ALLOWED_MAPS_HOSTS.has(host)) {
    return true;
  }
  return (
    host.startsWith('maps.google.') ||
    host.startsWith('www.google.') ||
    host.startsWith('google.')
  );
};

export const shouldExpandMapsUrl = (value: string): boolean => {
  if (!value) {
    return false;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    if (parsed.username || parsed.password) {
      return false;
    }
    if (parsed.port && parsed.port !== '443') {
      return false;
    }
    return isAllowedMapsHost(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
};

const tryGetWrappedMapsUrl = (value: URL): URL | null => {
  const host = value.hostname.toLowerCase();
  const isGoogleWrapperHost =
    host === 'consent.google.com' ||
    host === 'google.com' ||
    host.startsWith('www.google.') ||
    host.startsWith('google.');
  if (!isGoogleWrapperHost) {
    return null;
  }

  const redirectKeys = ['continue', 'q', 'url', 'dest', 'destination', 'u'];
  for (const key of redirectKeys) {
    const candidate = value.searchParams.get(key);
    if (!candidate) {
      continue;
    }
    try {
      const parsed = new URL(candidate, value);
      if (isAllowedMapsHost(parsed.hostname.toLowerCase())) {
        return parsed;
      }
    } catch {
      // ignore invalid wrapped URL values
    }
  }

  return null;
};

const isTransientMapsFetchError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();

  // 1) Системные/сетевые коды ошибок из Node.js/undici
  const networkCodes = [
    'ENETUNREACH',
    'EAI_AGAIN',
    'ETIMEDOUT',
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED',
  ];
  const code =
    (error as Error & { code?: unknown }).code ??
    (error as Error & { cause?: { code?: unknown } }).cause?.code;
  if (typeof code === 'string' && networkCodes.includes(code)) {
    return true;
  }

  if (typeof code === 'string' && code.startsWith('UND_ERR_')) {
    return true;
  }

  // 2) Ошибки, которые часто бросает fetch при неуспешном соединении
  if (error.name === 'TypeError' || error.name === 'FetchError') {
    return true;
  }

  // 3) Типовые фрагменты сообщений для временных сетевых/TLS-сбоев
  const transientMessageFragments = [
    'fetch failed',
    'failed to fetch',
    'failed to connect',
    'network error',
    'network is unreachable',
    'timed out',
    'timeout',
    'socket hang up',
    'tls',
    'ssl',
    'certificate',
  ];

  if (
    transientMessageFragments.some((fragment) =>
      normalizedMessage.includes(fragment),
    )
  ) {
    return true;
  }

  if (normalizedMessage.includes('слишком много редиректов')) {
    return true;
  }

  return false;
};

const assertSafeMapsUrl = async (urlObj: URL): Promise<void> => {
  if (urlObj.protocol !== 'https:') {
    throw new Error('Недопустимый протокол URL');
  }

  if (urlObj.username || urlObj.password) {
    throw new Error('URL не должен содержать userinfo');
  }

  if (urlObj.port && urlObj.port !== '' && urlObj.port !== '443') {
    throw new Error('Недопустимый порт URL');
  }

  const host = urlObj.hostname.toLowerCase();
  if (!isAllowedMapsHost(host)) {
    throw new Error('Недопустимый домен URL');
  }

  const isGoogleMapsHost =
    host === 'goo.gl' ||
    host === 'maps.app.goo.gl' ||
    host === 'google.com' ||
    host === 'maps.google.com' ||
    host === 'www.google.com' ||
    host.startsWith('maps.google.') ||
    host.startsWith('www.google.') ||
    host.startsWith('google.');

  let addresses;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    // Для жёстко ограниченного allowlist Google-доменов продолжаем работу
    // даже при временных проблемах DNS, иначе валидные ссылки могут
    // отклоняться как "invalid url" в изолированной среде.
    return;
  }
  if (!addresses || addresses.length === 0) {
    return;
  }
  if (
    isGoogleMapsHost &&
    addresses.every((addr) => isPrivateIp(addr.address))
  ) {
    // В некоторых окружениях (например, edge/proxy сети) DNS для валидных
    // Google-хостов может возвращать только внутренние IPv6-адреса.
    // Для жёстко ограниченного списка доменов Google это не SSRF-вектор,
    // поэтому не отклоняем ссылку, чтобы избежать ложных 400.
    return;
  }
  for (const addr of addresses) {
    if (isPrivateIp(addr.address)) {
      throw new Error('Домен URL разрешается во внутренний или запрещённый IP');
    }
  }
};

const decodeMapsUrlCandidate = (candidate: string): string | null => {
  if (!candidate) return null;
  let current = candidate.replace(/\\\//g, '/').replace(/\\u003d/gi, '=');
  current = current.replace(/\\u003a/gi, ':').replace(/\\u002f/gi, '/');
  current = current.replace(/\\u0026amp;/gi, '&amp;');
  current = current.replace(/\\u0026(?=[\w%.-]+=)/gi, '&');
  current = current.replace(/&amp;(?=[\w%.-]+=)/gi, '&');
  current = current.replace(/["']+$/g, '');
  try {
    const parsed = new URL(current);
    const host = parsed.hostname.toLowerCase();
    const isMapsHost =
      host === 'google.com' ||
      host === 'maps.google.com' ||
      host.startsWith('maps.google.') ||
      host.startsWith('google.') ||
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

const MAPS_BROWSER_LIKE_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ru,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
};

const STATIC_MAP_PATH = '/maps/api/staticmap';
const MAPS_HEADLESS_FALLBACK_ENABLED =
  (process.env.MAPS_HEADLESS_FALLBACK || '').toLowerCase() === 'playwright';
const MAPS_HEADLESS_MODULE_NAME =
  process.env.MAPS_HEADLESS_MODULE_NAME || 'playwright';
const MAPS_HEADLESS_TIMEOUT_MS = Math.min(
  Math.max(
    Number.parseInt(process.env.MAPS_HEADLESS_TIMEOUT_MS || '', 10) || 8000,
    1000,
  ),
  20000,
);

type PlaywrightChromiumLike = {
  launch: (options?: Record<string, unknown>) => Promise<{
    newContext: (options?: Record<string, unknown>) => Promise<{
      newPage: () => Promise<{
        goto: (
          target: string,
          options?: Record<string, unknown>,
        ) => Promise<void>;
        evaluate: <T>(pageFunction: () => T) => Promise<T>;
        locator: (selector: string) => {
          first: () => {
            textContent: () => Promise<string | null>;
          };
        };
        waitForTimeout: (timeout: number) => Promise<void>;
        close: () => Promise<void>;
      }>;
      close: () => Promise<void>;
    }>;
    close: () => Promise<void>;
  }>;
};

const MODULE_NOT_FOUND_CODE = 'MODULE_NOT_FOUND';
let hasLoggedMissingHeadlessModule = false;

const isMissingHeadlessModuleError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as Error & { code?: unknown }).code;
  if (code !== MODULE_NOT_FOUND_CODE) {
    return false;
  }

  return (
    error.message.includes(
      `Cannot find module '${MAPS_HEADLESS_MODULE_NAME}'`,
    ) ||
    error.message.includes(`Cannot find package '${MAPS_HEADLESS_MODULE_NAME}'`)
  );
};

const getPlaywrightChromium =
  async (): Promise<PlaywrightChromiumLike | null> => {
    try {
      const playwright = (await import(MAPS_HEADLESS_MODULE_NAME)) as {
        chromium?: PlaywrightChromiumLike;
      };
      return playwright.chromium ?? null;
    } catch (error) {
      if (isMissingHeadlessModuleError(error)) {
        if (!hasLoggedMissingHeadlessModule) {
          hasLoggedMissingHeadlessModule = true;
          console.warn(
            `Headless fallback disabled: module "${MAPS_HEADLESS_MODULE_NAME}" is not installed in this runtime`,
          );
        }
        return null;
      }
      throw error;
    }
  };

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

const extractCoordsViaPlaywright = async (
  url: string,
): Promise<Coordinates | null> => {
  if (!MAPS_HEADLESS_FALLBACK_ENABLED) {
    return null;
  }

  try {
    const chromium = await getPlaywrightChromium();
    if (!chromium) {
      return null;
    }

    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    try {
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: MAPS_HEADLESS_TIMEOUT_MS,
      });

      const rendered = await page.evaluate(() => {
        const payloads: string[] = [];
        const windowData = window as unknown as Record<string, unknown>;
        const appState = windowData.APP_INITIALIZATION_STATE;
        const pageData = windowData.pageData;
        const initialData = windowData.__INITIAL_DATA__;

        const pushIfString = (value: unknown) => {
          if (typeof value === 'string' && value.trim()) {
            payloads.push(value);
          }
        };

        const pushIfJson = (value: unknown) => {
          if (value === null || value === undefined) {
            return;
          }
          if (typeof value === 'object') {
            try {
              payloads.push(JSON.stringify(value));
            } catch {
              // ignore circular / non-serializable objects
            }
            return;
          }
          pushIfString(value);
        };

        pushIfJson(appState);
        pushIfJson(pageData);
        pushIfJson(initialData);
        pushIfString(location.href);
        pushIfString(document.documentElement?.innerHTML || '');

        return payloads.join('\n');
      });

      return extractCoords(rendered);
    } finally {
      await page.close();
      await context.close();
      await browser.close();
    }
  } catch (error) {
    console.warn('Headless fallback for maps parsing failed', error);
    return null;
  }
};

export type MapsPlaceDetails = {
  name: string;
  category?: string;
  address?: string;
};

export const extractPlaceDetailsViaPlaywright = async (
  url: string,
): Promise<MapsPlaceDetails | null> => {
  if (!MAPS_HEADLESS_FALLBACK_ENABLED) {
    return null;
  }

  try {
    const chromium = await getPlaywrightChromium();
    if (!chromium) {
      return null;
    }

    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      locale: 'uk-UA',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: MAPS_HEADLESS_TIMEOUT_MS,
      });
      await page.waitForTimeout(1200);

      const readText = async (selectors: string[]): Promise<string | null> => {
        for (const selector of selectors) {
          const text = await page.locator(selector).first().textContent();
          if (typeof text === 'string' && text.trim()) {
            return text.trim();
          }
        }
        return null;
      };

      const name = await readText([
        'h1.DUwDvf',
        'h1[data-attrid="title"]',
        '[role="main"] h1',
      ]);

      if (!name) {
        return null;
      }

      const category = await readText([
        'button.DkEaL',
        'button[jsaction*="pane.rating.category"]',
        '[data-item-id="authority"] button',
      ]);

      const address = await readText([
        'button[data-item-id="address"] .Io6YTe',
        'button[data-item-id="address"]',
      ]);

      return {
        name,
        ...(category ? { category } : {}),
        ...(address ? { address } : {}),
      };
    } finally {
      await page.close();
      await context.close();
      await browser.close();
    }
  } catch (error) {
    console.warn('Headless fallback for place details parsing failed', error);
    return null;
  }
};

export type { Coordinates };

export async function expandMapsUrl(shortUrl: string): Promise<string> {
  // Развёртывает короткий URL Google Maps с проверкой домена и протокола
  let urlObj: URL;

  try {
    urlObj = new URL(shortUrl);
  } catch {
    throw new Error('Некорректный URL');
  }

  const fetchWithSafeRedirects = async (
    initialUrl: URL,
    maxRedirects = 5,
  ): Promise<{ res: Response; finalUrl: URL }> => {
    let currentUrl = initialUrl;
    const visitedUrls = new Set<string>();
    for (let i = 0; i <= maxRedirects; i += 1) {
      const unwrappedCurrentUrl = tryGetWrappedMapsUrl(currentUrl);
      if (unwrappedCurrentUrl) {
        currentUrl = unwrappedCurrentUrl;
      }

      const currentKey = currentUrl.toString();
      if (visitedUrls.has(currentKey)) {
        throw new Error('Слишком много редиректов');
      }
      visitedUrls.add(currentKey);

      await assertSafeMapsUrl(currentUrl);
      const res = await fetch(currentUrl.toString(), { redirect: 'manual' });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) {
          throw new Error('Ответ редиректа без заголовка Location');
        }
        let nextUrl: URL;
        try {
          nextUrl = new URL(location, currentUrl);
        } catch {
          return { res, finalUrl: currentUrl };
        }
        if (nextUrl.protocol !== 'http:' && nextUrl.protocol !== 'https:') {
          return { res, finalUrl: currentUrl };
        }
        currentUrl = tryGetWrappedMapsUrl(nextUrl) ?? nextUrl;
        continue;
      }
      return { res, finalUrl: currentUrl };
    }
    throw new Error('Слишком много редиректов');
  };

  let res: Response;
  let finalUrl: URL;

  try {
    const expanded = await fetchWithSafeRedirects(urlObj);
    res = expanded.res;
    finalUrl = expanded.finalUrl;
  } catch (error) {
    if (isTransientMapsFetchError(error)) {
      return normalizeMapsUrl(urlObj.toString());
    }
    throw error;
  }

  const finalUrlString = normalizeMapsUrl(finalUrl.toString());
  if (hasCoordsInUrl(finalUrlString)) {
    return finalUrlString;
  }

  if (finalUrl.hostname.toLowerCase() === 'maps.app.goo.gl') {
    try {
      const followed = await fetch(finalUrlString, {
        redirect: 'follow',
        headers: MAPS_BROWSER_LIKE_HEADERS,
      });
      const followedUrl = normalizeMapsUrl(followed.url || finalUrlString);
      const followedUrlObj = new URL(followedUrl);
      await assertSafeMapsUrl(followedUrlObj);
      if (hasCoordsInUrl(followedUrl)) {
        return followedUrl;
      }
    } catch {
      // Ignore fallback errors and continue with HTML/body parsing.
    }
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

  const renderedCoords = await extractCoordsViaPlaywright(finalUrlString);
  if (renderedCoords) {
    return buildCoordsUrl(renderedCoords);
  }

  return finalUrlString;
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
