// Назначение: формирование ссылки маршрута Google Maps из последовательности точек.
// Модули: shared
import { generateMultiRouteLink, type Coords } from "shared";

export default function createMultiRouteLink(
  points: Coords[] = [],
  mode: string = "driving",
): string {
  return generateMultiRouteLink(points, mode);
}
