// Назначение файла: общие настройки карт для веб-клиента
// Основные модули: отсутствуют

declare const __ERM_MAPBOX_ACCESS_TOKEN__: string | undefined;
declare const __ERM_MAP_STYLE_URL__: string | undefined;

const tokenFromProcess =
  typeof process !== "undefined" ? process.env?.VITE_MAPBOX_ACCESS_TOKEN : undefined;

const styleFromProcess =
  typeof process !== "undefined" ? process.env?.VITE_MAPBOX_STYLE_URL : undefined;

const tokenFromDefine =
  typeof __ERM_MAPBOX_ACCESS_TOKEN__ !== "undefined"
    ? __ERM_MAPBOX_ACCESS_TOKEN__
    : undefined;

const styleFromDefine =
  typeof __ERM_MAP_STYLE_URL__ !== "undefined" ? __ERM_MAP_STYLE_URL__ : undefined;

export const MAPBOX_ACCESS_TOKEN = tokenFromProcess ?? tokenFromDefine ?? "";

export const MAP_STYLE_URL =
  styleFromProcess ?? styleFromDefine ?? "mapbox://styles/mapbox/streets-v12";

export const MAP_DEFAULT_CENTER: [number, number] = [48.3794, 31.1656];
export const MAP_DEFAULT_ZOOM = 6;
export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [22.1372, 44.3865],
  [40.2286, 52.3796],
];

export const MAP_ANIMATION_SPEED_KMH = 45;
