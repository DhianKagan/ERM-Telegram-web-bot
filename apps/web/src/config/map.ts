// Map config unified for MapLibre + Protomaps CDN
// URL стиля (light v5) — можно переопределить через VITE_MAP_STYLE_URL
export const MAP_STYLE_URL =
  (import.meta as any)?.env?.VITE_MAP_STYLE_URL ||
  'https://api.protomaps.com/styles/v5/light/en.json?key=e2ee205f93bfd080';

// Совместимость с существующими импортами:
export const MAP_STYLE = MAP_STYLE_URL;                  // ранее могли импортировать как MAP_STYLE
export const MAP_STYLE_MODE: 'light' | 'dark' = 'light'; // если в UI есть тумблер темы

// Атрибуция (Protomaps + OpenStreetMap contributors)
export const MAP_ATTRIBUTION =
  '© <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OSM contributors</a>';

// Центр/зум по умолчанию — Киев
export const MAP_DEFAULT_CENTER: [number, number] = [30.5234, 50.4501];
export const MAP_DEFAULT_ZOOM = 6;

// Глобальные границы мира (чтобы не улетать за пределы проекции)
export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [[-180, -85], [180, 85]];

// Идентификатор векторного источника; для стиля Protomaps v5 чаще 'basemap'
export const MAP_VECTOR_SOURCE_ID = 'basemap';

// Скорость анимации (если используется для пробегов транспорта)
export const MAP_ANIMATION_SPEED_KMH = 50;

// Ранее использовалось для локальных адресных pmtiles; теперь не требуется.
// Оставим пустой строкой для совместимости — код выше должен проверять на truthy.
export const MAP_ADDRESSES_PMTILES_URL = '';

// Дополнительные алиасы (если где-то использовались короткие имена)
export const DEFAULT_CENTER = MAP_DEFAULT_CENTER;
export const DEFAULT_ZOOM = MAP_DEFAULT_ZOOM;
