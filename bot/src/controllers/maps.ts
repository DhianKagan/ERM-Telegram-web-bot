// Розвёртывание коротких ссылок Google Maps
// Модули: express, services/maps
import { Request, Response } from 'express'
import { expandMapsUrl, extractCoords } from '../services/maps'

export async function expand(req: Request, res: Response): Promise<void> {
  try {
    const full = await expandMapsUrl(req.body.url)
    res.json({ url: full, coords: extractCoords(full) })
  } catch {
    res.status(400).json({ error: 'invalid url' })
  }
}

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(module as any).exports = { expand }
