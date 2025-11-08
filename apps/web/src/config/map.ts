// Centralized map style configuration for MapLibre + Protomaps CDN
export const MAP_STYLE_URL =
  (import.meta as any)?.env?.VITE_MAP_STYLE_URL ||
  'https://api.protomaps.com/styles/v5/light/en.json?key=e2ee205f93bfd080';

export const DEFAULT_CENTER: [number, number] = [30.5234, 50.4501]; // Kyiv
export const DEFAULT_ZOOM = 6;
