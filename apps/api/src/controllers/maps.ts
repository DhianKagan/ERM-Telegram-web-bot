// Розвёртывание коротких ссылок Google Maps
// Модули: express, services/maps, shared
import { Request, Response } from 'express';
import { expandMapsUrl } from '../services/maps';
import { extractCoords } from 'shared';
import { sendProblem } from '../utils/problem';

export async function expand(req: Request, res: Response): Promise<void> {
  try {
    const full = await expandMapsUrl(req.body.url);
    res.json({ url: full, coords: extractCoords(full) });
  } catch {
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Некорректная ссылка',
      status: 400,
      detail: 'invalid url',
    });
  }
}
