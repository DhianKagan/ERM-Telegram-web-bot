// Розвёртывание коротких ссылок Google Maps
// Модули: express, services/maps, shared, shortLinks
import { Request, Response } from 'express';
import {
  expandMapsUrl,
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
    const full = await expandMapsUrl(resolvedSource);
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
      coords: extractCoords(full),
      ...(shortUrl ? { short: shortUrl } : {}),
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
