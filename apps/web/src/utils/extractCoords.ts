// Назначение файла: извлечение координат из ссылок Google Maps
// Основные модули: shared
import { extractCoords as parseCoords, type Coords } from "shared";

export type LatLng = Coords;

export default function extractCoords(url: string): LatLng | null {
  return parseCoords(url) as LatLng | null;
}
