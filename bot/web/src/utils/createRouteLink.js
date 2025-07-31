// Формирование ссылки маршрута Google Maps из координат
import { generateRouteLink } from '../../../shared/mapUtils.js';

export default function createRouteLink(start, end, mode = 'driving') {
  return generateRouteLink(start, end, mode)
}
