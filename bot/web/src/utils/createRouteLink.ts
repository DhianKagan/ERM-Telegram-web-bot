// Назначение: формирование ссылки маршрута Google Maps из координат.
// Модули: shared/mapUtils
import mapUtils, { Coords } from '../../../src/shared/mapUtils';

export default function createRouteLink(
  start: Coords | null,
  end: Coords | null,
  mode: string = 'driving'
): string {
  return mapUtils.generateRouteLink(start, end, mode)
}
