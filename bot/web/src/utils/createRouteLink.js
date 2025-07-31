// Формирование ссылки маршрута Google Maps из координат
import mapUtils from '../../../shared/mapUtils.js';

export default function createRouteLink(start, end, mode = 'driving') {
  return mapUtils.generateRouteLink(start, end, mode)
}
