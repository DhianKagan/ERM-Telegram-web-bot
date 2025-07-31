// Формирование ссылки маршрута Google Maps из последовательности точек (до 10)
import { generateMultiRouteLink } from '../../../shared/mapUtils.js';

export default function createMultiRouteLink(points = [], mode = 'driving') {
  return generateMultiRouteLink(points, mode)
}
