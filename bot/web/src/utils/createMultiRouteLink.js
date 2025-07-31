// Формирование ссылки маршрута Google Maps из последовательности точек (до 10)
import mapUtils from '../../../shared/mapUtils.js';

export default function createMultiRouteLink(points = [], mode = 'driving') {
  return mapUtils.generateMultiRouteLink(points, mode)
}
