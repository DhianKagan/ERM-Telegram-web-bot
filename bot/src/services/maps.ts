// Получение полной ссылки Google Maps и вспомогательные функции
// Модули: node.js fetch, shared/mapUtils
import mapUtils from '../shared/mapUtils.js';

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

  const res = await fetch(urlObj.toString(), { redirect: 'follow' });
  return res.url;
}

const maps = {
  expandMapsUrl,
  extractCoords,
  generateRouteLink,
  generateMultiRouteLink,
};

export default maps;

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(module as any).exports = maps;
