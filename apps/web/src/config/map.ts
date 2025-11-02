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

const resolvedToken = tokenFromProcess ?? tokenFromDefine ?? "";

const DEFAULT_STYLE_URL = "mapbox://styles/mapbox/streets-v12";
const FALLBACK_STYLE_URL = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

const requestedStyle = styleFromProcess ?? styleFromDefine ?? DEFAULT_STYLE_URL;

const isMapboxHostedStyle = requestedStyle.startsWith("mapbox://") ||
  requestedStyle.includes("api.mapbox.com");

const shouldFallbackToTokenlessStyle = isMapboxHostedStyle && resolvedToken === "";

export const MAPBOX_ACCESS_TOKEN = resolvedToken;

export const MAP_STYLE_URL = shouldFallbackToTokenlessStyle
  ? FALLBACK_STYLE_URL
  : requestedStyle;

export const MAP_STYLE_REQUIRES_TOKEN = isMapboxHostedStyle;
export const MAP_STYLE_FALLBACK_USED = shouldFallbackToTokenlessStyle;

export const MAP_DEFAULT_CENTER: [number, number] = [48.3794, 31.1656];
export const MAP_DEFAULT_ZOOM = 6;
export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [22.1372, 44.3865],
  [40.2286, 52.3796],
];

export const MAP_ANIMATION_SPEED_KMH = 45;
