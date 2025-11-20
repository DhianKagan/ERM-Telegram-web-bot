// apps/web/src/config/map.ts
/**
 * Map configuration for MapLibre + Protomaps CDN + local PMTiles addresses.
 *
 * Обеспечивает считывание VITE_MAP_STYLE_URL и VITE_MAP_ADDRESSES_PMTILES_URL
 * как из process.env (SSR / server) так и из import.meta.env (Vite).
 *
 * MAP_STYLE_MODE выводится как:
 * - 'pmtiles' для векторных стилей (включая Protomaps CDN)
 * - 'raster' для tile.openstreetmap.org
 *
 * При использовании кастомного стиля из env, по умолчанию режим — 'pmtiles'
 * (если не задано __ERM_MAP_STYLE_MODE__ глобально).
 */

type MapStyleMode = 'pmtiles' | 'raster';

declare const __ERM_MAP_STYLE_MODE__: MapStyleMode | undefined;

// По умолчанию берём стиль Protomaps (можно переопределить через переменную среды)
const DEFAULT_MAP_STYLE_URL =
  'https://api.protomaps.com/styles/v5/light/uk.json?key=e2ee205f93bfd080';

type MapStyleSource = 'default' | 'env';

type ImportMetaWithEnv = {
  readonly env?: {
    readonly VITE_MAP_STYLE_URL?: string;
    readonly VITE_MAP_ADDRESSES_PMTILES_URL?: string;
  };
};

// Читаем URL стиля: сначала process.env (сервер), потом import.meta.env (клиент), иначе DEFAULT_MAP_STYLE_URL
const readMapStyle = (): { url: string; source: MapStyleSource } => {
  const processValue =
    typeof process !== 'undefined' && typeof process.env === 'object'
      ? process.env.VITE_MAP_STYLE_URL
      : undefined;
  if (typeof processValue === 'string' && processValue.trim() !== '') {
    return { url: processValue.trim(), source: 'env' };
  }
  try {
    const meta = import.meta as unknown as ImportMetaWithEnv;
    const metaValue = meta?.env?.VITE_MAP_STYLE_URL;
    if (typeof metaValue === 'string' && metaValue.trim() !== '') {
      return { url: metaValue.trim(), source: 'env' };
    }
  } catch {
    // Игнорируем отсутствие import.meta в окружении тестов/SSR
  }
  return { url: DEFAULT_MAP_STYLE_URL, source: 'default' };
};

// Считываем режим стиля, который можно установить глобально __ERM_MAP_STYLE_MODE__
const readRuntimeMapStyleMode = (): MapStyleMode | undefined => {
  if (typeof __ERM_MAP_STYLE_MODE__ !== 'undefined') {
    return __ERM_MAP_STYLE_MODE__;
  }
  if (typeof globalThis === 'object' && globalThis !== null) {
    const candidate = (
      globalThis as {
        __ERM_MAP_STYLE_MODE__?: unknown;
      }
    ).__ERM_MAP_STYLE_MODE__;
    if (candidate === 'pmtiles' || candidate === 'raster') {
      return candidate;
    }
  }
  return undefined;
};

// URL стиля (по умолчанию — ProtoMaps CDN)
const mapStyle = readMapStyle();
export const MAP_STYLE_URL = mapStyle.url;

const runtimeMode = readRuntimeMapStyleMode();
const isCustomStyle = mapStyle.source === 'env';

// Итоговый режим:
// - если есть глобальный __ERM_MAP_STYLE_MODE__ -> берём его
// - иначе если стиль был задан из env -> runtimeMode ?? 'pmtiles'
// - иначе определяем по URL (tile.openstreetmap.org -> raster, иначе pmtiles)
const autoModeFromUrl = (url: string): MapStyleMode =>
  url.includes('tile.openstreetmap.org') ? 'raster' : 'pmtiles';

export const MAP_STYLE_MODE: MapStyleMode = (() => {
  if (runtimeMode) return runtimeMode;
  if (isCustomStyle) return runtimeMode ?? 'pmtiles';
  return autoModeFromUrl(MAP_STYLE_URL);
})();

export const MAP_STYLE = MAP_STYLE_URL; // backward compatibility
export const MAP_STYLE_DEFAULT_URL = DEFAULT_MAP_STYLE_URL;
export const MAP_STYLE_IS_DEFAULT = mapStyle.source === 'default';

// Атрибуция (Protomaps + OSM)
export const MAP_ATTRIBUTION =
  '© <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OSM contributors</a>';

// Центр/зум по умолчанию — Киев
export const MAP_DEFAULT_CENTER: [number, number] = [30.5234, 50.4501];
export const MAP_DEFAULT_ZOOM = 6;

// Границы мира
export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-180, -85],
  [180, 85],
];

// Идентификатор векторного источника; для Protomaps v5 — 'basemap'
export const MAP_VECTOR_SOURCE_ID = 'basemap';

// Скорость анимации для пробегов транспорта
export const MAP_ANIMATION_SPEED_KMH = 50;

/* ---------- Локальные PMTiles (addresses) ---------- */

const readAddressTilesUrl = (): string => {
  const processValue =
    typeof process !== 'undefined' && typeof process.env === 'object'
      ? process.env.VITE_MAP_ADDRESSES_PMTILES_URL
      : undefined;
  if (typeof processValue === 'string' && processValue.trim() !== '') {
    return processValue.trim();
  }
  try {
    const meta = import.meta as unknown as ImportMetaWithEnv;
    const metaValue = meta?.env?.VITE_MAP_ADDRESSES_PMTILES_URL;
    if (typeof metaValue === 'string' && metaValue.trim() !== '') {
      return metaValue.trim();
    }
  } catch {
    // Игнорируем отсутствие import.meta в тестах/SSR
  }
  return '';
};

export const MAP_ADDRESSES_PMTILES_URL = readAddressTilesUrl();

// Алиасы
export const DEFAULT_CENTER = MAP_DEFAULT_CENTER;
export const DEFAULT_ZOOM = MAP_DEFAULT_ZOOM;
