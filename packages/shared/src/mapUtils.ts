// Назначение: общие функции для работы с Google Maps.
// Модули: utils

export interface Coords {
  lat: number;
  lng: number;
}

const COORD_PAIR_PATTERN = /(-?\d+(?:\.\d+)?)[,\s+]+(-?\d+(?:\.\d+)?)/;

const parseCoordPair = (latRaw: string, lngRaw: string): Coords | null => {
  const lat = Number.parseFloat(latRaw);
  const lng = Number.parseFloat(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
};

const parseCombinedValue = (value: string | null | undefined): Coords | null => {
  if (!value) {
    return null;
  }
  const decoded = decodeURIComponent(value);
  const match = decoded.match(COORD_PAIR_PATTERN);
  if (!match) {
    return null;
  }
  return parseCoordPair(match[1], match[2]);
};

export function extractCoords(url: string): Coords | null {
  if (!url) {
    return null;
  }
  try {
    const candidate = new URL(url, 'https://maps.google.com');
    const searchKeys = [
      'q',
      'query',
      'll',
      'center',
      'sll',
      'destination',
      'origin',
      'daddr',
      'saddr',
    ];
    for (const key of searchKeys) {
      const coords = parseCombinedValue(candidate.searchParams.get(key));
      if (coords) {
        return coords;
      }
    }
    const hashCoords = parseCombinedValue(candidate.hash.replace(/^#/, ''));
    if (hashCoords) {
      return hashCoords;
    }
  } catch {
    // Пропускаем ошибки парсинга URL, пробуем регулярные выражения ниже.
  }
  const decoded = decodeURIComponent(url);
  const bangMatch = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (bangMatch) {
    const coords = parseCoordPair(bangMatch[1], bangMatch[2]);
    if (coords) {
      return coords;
    }
  }
  const invertedBangMatch = decoded.match(/!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/);
  if (invertedBangMatch) {
    const coords = parseCoordPair(invertedBangMatch[2], invertedBangMatch[1]);
    if (coords) {
      return coords;
    }
  }
  const atMatch = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const coords = parseCoordPair(atMatch[1], atMatch[2]);
    if (coords) {
      return coords;
    }
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
