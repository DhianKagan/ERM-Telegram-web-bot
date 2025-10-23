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

const MAPS_URL_PATTERNS = [
  /https:\/\/(?:www\.)?google\.[^"'\s<>]+/gi,
  /https:\/\/maps\.google\.[^"'\s<>]+/gi,
];

const decodeMapsUrlCandidate = (candidate: string): string | null => {
  if (!candidate) return null;
  let current = candidate
    .replace(/\\\//g, '/')
    .replace(/\\u003d/gi, '=')
    .replace(/\\u0026/gi, '&');
  current = current.replace(/&amp;/gi, '&');
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
    if (host.startsWith('www.google.') && !parsed.pathname.startsWith('/maps')) {
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
  `https://www.google.com/maps/?q=${formatCoordinate(coords.lat)},${formatCoordinate(
    coords.lng,
  )}`;

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
  const finalUrl = res.url || urlObj.toString();
  if (hasCoordsInUrl(finalUrl)) {
    return finalUrl;
  }

  if (typeof (res as { text?: () => Promise<string> }).text === 'function') {
    try {
      const body = await (res as { text: () => Promise<string> }).text();
      const fallbackUrl = findMapsUrlInBody(body);
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

const maps = {
  expandMapsUrl,
  extractCoords,
  generateRouteLink,
  generateMultiRouteLink,
};

export default maps;

export { extractCoords, generateRouteLink, generateMultiRouteLink };
