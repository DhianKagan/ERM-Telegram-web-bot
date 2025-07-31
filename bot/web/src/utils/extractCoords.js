// Извлекает координаты из ссылки Google Maps
import { extractCoords as sharedExtract } from '../../../shared/mapUtils.js';

export default function extractCoords(url) {
  return sharedExtract(url)
}
