// Назначение: формирование ссылки маршрута Google Maps из последовательности точек.
// Модули: shared/mapUtils
import mapUtils, { Coords } from '../../../src/shared/mapUtils';

export default function createMultiRouteLink(
  points: Coords[] = [],
  mode: string = 'driving'
): string {
  return mapUtils.generateMultiRouteLink(points, mode)
}
