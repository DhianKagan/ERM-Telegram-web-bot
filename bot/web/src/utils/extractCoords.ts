// Назначение: извлечение координат из ссылки Google Maps.
// Модули: shared/mapUtils
import mapUtils, { Coords } from '../../../src/shared/mapUtils';

export default function extractCoords(url: string): Coords | null {
  return mapUtils.extractCoords(url)
}
