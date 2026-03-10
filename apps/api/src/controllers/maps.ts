// Розвёртывание коротких ссылок Google Maps
// Модули: express, services/maps, shared, shortLinks
import { Request, Response } from 'express';
import {
  expandMapsUrl,
  extractPlaceDetailsViaPlaywright,
  searchAddress as searchAddressService,
  reverseGeocode as reverseGeocodeService,
} from '../services/maps';
import { extractCoords } from 'shared';
import { sendProblem } from '../utils/problem';
import {
  ensureShortLink,
  resolveShortLink,
  isShortLink,
} from '../services/shortLinks';
import { normalizeManagedShortLink } from '../services/taskLinks';

const looksLikeMapsUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (host === 'maps.app.goo.gl') {
      return true;
    }
    if (!host.includes('google.')) {
      return false;
    }
    return parsed.pathname.startsWith('/maps');
  } catch {
    return false;
  }
};

const buildGoogleMapsLink = (coords: { lat: number; lng: number }): string =>
  `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;

const extractPlaceNameFromMapsUrl = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    const placeMarker = '/maps/place/';
    const pathname = parsed.pathname;
    const index = pathname.toLowerCase().indexOf(placeMarker);
    if (index !== -1) {
      const placePart = pathname.slice(index + placeMarker.length);
      const encodedName = placePart.split('/')[0] || '';
      if (encodedName) {
        const decoded = decodeURIComponent(
          encodedName.replace(/\+/g, ' '),
        ).trim();
        if (decoded && !extractCoords(decoded)) {
          return decoded;
        }
      }
    }

    const queryFromParams =
      parsed.searchParams.get('query') || parsed.searchParams.get('q');
    if (queryFromParams && !extractCoords(queryFromParams)) {
      const normalized = queryFromParams.trim();
      if (normalized) {
        return normalized;
      }
    }
  } catch {
    return null;
  }

  return null;
};

const extractTextQueryFromMapsUrl = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    const queryFromParams =
      parsed.searchParams.get('query') || parsed.searchParams.get('q');
    if (queryFromParams && !extractCoords(queryFromParams)) {
      return queryFromParams.trim() || null;
    }

    const placeMarker = '/maps/place/';
    const pathname = parsed.pathname;
    const index = pathname.toLowerCase().indexOf(placeMarker);
    if (index === -1) {
      return null;
    }
    const placePart = pathname.slice(index + placeMarker.length);
    const encodedName = placePart.split('/')[0] || '';
    if (!encodedName) {
      return null;
    }
    const decoded = decodeURIComponent(encodedName.replace(/\+/g, ' ')).trim();
    if (!decoded || extractCoords(decoded)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
};

export async function expand(req: Request, res: Response): Promise<void> {
  try {
    const input = typeof req.body.url === 'string' ? req.body.url.trim() : '';
    if (!input) {
      throw new Error('empty');
    }
    const managedShortLink = isShortLink(input);
    let resolvedSource = input;
    if (managedShortLink) {
      const expanded = await resolveShortLink(input);
      if (!expanded) {
        throw new Error('not-found');
      }
      resolvedSource = expanded;
    }
    let full = resolvedSource;
    try {
      full = await expandMapsUrl(resolvedSource);
    } catch (error) {
      const canFallbackToSource =
        managedShortLink || looksLikeMapsUrl(resolvedSource);
      if (!canFallbackToSource) {
        throw error;
      }
      console.warn(
        'Не удалось развернуть ссылку карты, используем исходную ссылку',
        error,
      );
    }

    let coords = extractCoords(full);
    let place = null;
    const placeNameFromUrl = extractPlaceNameFromMapsUrl(full);
    if (placeNameFromUrl) {
      place = { name: placeNameFromUrl };
    }

    if (!place && !coords) {
      try {
        place = await extractPlaceDetailsViaPlaywright(full);
      } catch (error) {
        console.warn('Не удалось извлечь данные места из ссылки карты', error);
      }
    }

    if (!coords) {
      const locationHintCandidates = [
        place?.address,
        place?.name,
        extractTextQueryFromMapsUrl(full),
      ].filter(
        (candidate): candidate is string =>
          typeof candidate === 'string' && Boolean(candidate.trim()),
      );

      for (const hint of locationHintCandidates) {
        try {
          const [bestMatch] = await searchAddressService(hint, { limit: 1 });
          if (!bestMatch) {
            continue;
          }
          coords = { lat: bestMatch.lat, lng: bestMatch.lng };
          full = buildGoogleMapsLink(coords);
          break;
        } catch (error) {
          console.warn(
            'Не удалось определить координаты из текстовой подсказки',
            {
              hint,
              error,
            },
          );
        }
      }
    }

    let shortUrl: string | undefined;
    if (managedShortLink) {
      shortUrl = normalizeManagedShortLink(input);
    } else {
      try {
        const { shortUrl: ensured } = await ensureShortLink(full);
        shortUrl = ensured;
      } catch (error) {
        console.error('Не удалось создать короткую ссылку для карты', error);
      }
    }
    res.json({
      url: full,
      coords,
      ...(shortUrl ? { short: shortUrl } : {}),
      ...(place ? { place } : {}),
    });
  } catch {
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Некорректная ссылка',
      status: 400,
      detail: 'invalid url',
    });
  }
}

export async function search(req: Request, res: Response): Promise<void> {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    if (!query.trim()) {
      res.json({ items: [] });
      return;
    }
    const languageHeader =
      typeof req.headers['accept-language'] === 'string'
        ? req.headers['accept-language']
        : undefined;
    const items = await searchAddressService(query, {
      limit:
        typeof req.query.limit === 'string'
          ? Number.parseInt(req.query.limit, 10)
          : undefined,
      language: languageHeader,
    });
    res.json({ items });
  } catch (error) {
    console.error('Ошибка поиска адреса через Nominatim', error);
    res.json({ items: [] });
  }
}

export async function reverse(req: Request, res: Response): Promise<void> {
  try {
    const latRaw = typeof req.query.lat === 'string' ? req.query.lat : '';
    const lngRaw =
      typeof req.query.lng === 'string'
        ? req.query.lng
        : typeof req.query.lon === 'string'
          ? req.query.lon
          : '';
    const lat = Number.parseFloat(latRaw);
    const lng = Number.parseFloat(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.json({ place: null });
      return;
    }
    const languageHeader =
      typeof req.headers['accept-language'] === 'string'
        ? req.headers['accept-language']
        : undefined;
    const place = await reverseGeocodeService(
      { lat, lng },
      { language: languageHeader },
    );
    res.json({ place });
  } catch (error) {
    console.error('Ошибка реверс-геокодирования через Nominatim', error);
    res.json({ place: null });
  }
}
