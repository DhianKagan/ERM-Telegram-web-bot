// Назначение файла: общие настройки карт для веб-клиента
// Основные модули: отсутствуют

export const MAP_STYLE_URL =
  "https://openmaptiles.geo.data.gouv.fr/styles/osm-bright/style.json";

export const MAP_DEFAULT_CENTER: [number, number] = [48.3794, 31.1656];
export const MAP_DEFAULT_ZOOM = 6;
export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [22.1372, 44.3865],
  [40.2286, 52.3796],
];

export const MAP_ANIMATION_SPEED_KMH = 45;
