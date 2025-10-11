// Розвёртывание коротких ссылок Google Maps
// Модули: express, services/maps, shared, shortLinks
import { Request, Response } from 'express';
import { expandMapsUrl } from '../services/maps';
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
    let resolvedSource = input;
    if (isShortLink(input)) {
      const expanded = await resolveShortLink(input);
      if (!expanded) {
        throw new Error('not-found');
      }
      resolvedSource = expanded;
    }
    const full = await expandMapsUrl(resolvedSource);
    let shortUrl: string | undefined;
    if (isShortLink(input)) {
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
