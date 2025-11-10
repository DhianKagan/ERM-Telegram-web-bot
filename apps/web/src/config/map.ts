// Map config unified for MapLibre + Protomaps CDN

type MapStyleMode = 'pmtiles' | 'raster';

declare const __ERM_MAP_STYLE_MODE__: MapStyleMode | undefined;

const DEFAULT_MAP_STYLE_URL =
  'https://api.protomaps.com/styles/v5/light/en.json?key=e2ee205f93bfd080';

type ImportMetaWithEnv = { readonly env?: { readonly VITE_MAP_STYLE_URL?: string } };

const readMapStyleUrl = (): string => {
  const processValue =
    typeof process !== 'undefined' && typeof process.env === 'object'
      ? process.env.VITE_MAP_STYLE_URL
      : undefined;
  if (typeof processValue === 'string' && processValue.trim() !== '') {
    return processValue;
  }
  try {
    const meta = import.meta as unknown as ImportMetaWithEnv;
    const metaValue = meta?.env?.VITE_MAP_STYLE_URL;
    if (typeof metaValue === 'string' && metaValue.trim() !== '') {
      return metaValue;
    }
  } catch {
    // Игнорируем отсутствие import.meta в окружении тестов.
  }
  return DEFAULT_MAP_STYLE_URL;
};

const resolveMapStyleMode = (): MapStyleMode => {
  if (typeof __ERM_MAP_STYLE_MODE__ !== 'undefined') {
    return __ERM_MAP_STYLE_MODE__;
  }
  if (typeof globalThis === 'object' && globalThis !== null) {
    const candidate = (globalThis as {
      __ERM_MAP_STYLE_MODE__?: unknown;
    }).__ERM_MAP_STYLE_MODE__;
    if (candidate === 'pmtiles' || candidate === 'raster') {
      return candidate;
    }
  }
  return 'raster';
};

// URL стиля (light v5) — можно переопределить через VITE_MAP_STYLE_URL
export const MAP_STYLE_URL = readMapStyleUrl();

// Совместимость с существующими импортами:
export const MAP_STYLE = MAP_STYLE_URL; // ранее могли импортировать как MAP_STYLE
export const MAP_STYLE_MODE: MapStyleMode = resolveMapStyleMode();

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

// Локальный путь к адресным PMTiles.
export const MAP_ADDRESSES_PMTILES_URL = 'pmtiles://tiles/addresses.pmtiles';

// Дополнительные алиасы (если где-то использовались короткие имена)
export const DEFAULT_CENTER = MAP_DEFAULT_CENTER;
export const DEFAULT_ZOOM = MAP_DEFAULT_ZOOM;
