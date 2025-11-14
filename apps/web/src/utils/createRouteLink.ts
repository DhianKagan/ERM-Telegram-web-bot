// Назначение: формирование ссылки маршрута Google Maps из координат.
// Модули: shared
import { generateRouteLink, type Coords } from 'shared';

export default function createRouteLink(
  start: Coords | null,
  end: Coords | null,
  mode: string = 'driving',
): string {
  return generateRouteLink(start, end, mode);
}
