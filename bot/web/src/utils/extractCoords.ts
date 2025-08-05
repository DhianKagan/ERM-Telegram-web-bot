// Назначение файла: извлечение координат из ссылок Google Maps
// Основные модули: web utils
import mapUtils from '../../../src/shared/mapUtils.js'

interface LatLng {
  lat: number
  lng: number
}

export default function extractCoords(url: string): LatLng | null {
  return mapUtils.extractCoords(url) as LatLng | null
}
