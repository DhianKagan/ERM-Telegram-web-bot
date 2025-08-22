// Назначение: общие функции для работы с Google Maps.
// Модули: utils

export interface Coords {
  lat: number;
  lng: number;
}

export function extractCoords(url: string): Coords | null {
  const m =
    url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
    url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) {
    return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  }
  return null;
}

export function generateRouteLink(
  start: Coords | null | undefined,
  end: Coords | null | undefined,
  mode: string = 'driving',
): string {
  if (!start || !end) return '';
  return `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lng}&destination=${end.lat},${end.lng}&travelmode=${mode}`;
}

export function generateMultiRouteLink(
  points: Coords[] = [],
  mode: string = 'driving',
): string {
  if (!Array.isArray(points) || points.length < 2) return '';
  const pts = points.slice(0, 10);
  const origin = pts[0];
  const destination = pts[pts.length - 1];
  const waypoints = pts
    .slice(1, -1)
    .map((p) => `${p.lat},${p.lng}`)
    .join('|');
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=${mode}`;
  if (waypoints) url += `&waypoints=${waypoints}`;
  return url;
}

export default { extractCoords, generateRouteLink, generateMultiRouteLink };
