// Получение полной ссылки Google Maps и вспомогательные функции
// Модули: node.js fetch, dns/promises, net, shared/mapUtils
import { lookup } from 'dns/promises';
import net from 'net';
import mapUtils from '../shared/mapUtils';

export interface Coordinates {
  lat: number;
  lng: number;
}

export const { extractCoords, generateRouteLink, generateMultiRouteLink } =
  mapUtils as {
    extractCoords: (url: string) => Coordinates | null;
    generateRouteLink: (
      start: Coordinates | null,
      end: Coordinates | null,
      mode?: string,
    ) => string;
    generateMultiRouteLink: (points?: Coordinates[], mode?: string) => string;
  };

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
  return res.url;
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
