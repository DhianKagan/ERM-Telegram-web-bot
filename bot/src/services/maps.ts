// Получение полной ссылки Google Maps и вспомогательные функции
// Модули: node.js fetch, shared/mapUtils
import mapUtils from '../shared/mapUtils.js'

export interface Coordinates { lat: number; lng: number }

export const {
  extractCoords,
  generateRouteLink,
  generateMultiRouteLink,
} = mapUtils as {
  extractCoords: (url: string) => Coordinates | null
  generateRouteLink: (
    start: Coordinates | null,
    end: Coordinates | null,
    mode?: string,
  ) => string
  generateMultiRouteLink: (points?: Coordinates[], mode?: string) => string
}

export async function expandMapsUrl(shortUrl: string): Promise<string> {
  const res = await fetch(shortUrl, { redirect: 'follow' })
  return res.url
}

const maps = {
  expandMapsUrl,
  extractCoords,
  generateRouteLink,
  generateMultiRouteLink,
}

export default maps

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(module as any).exports = maps
