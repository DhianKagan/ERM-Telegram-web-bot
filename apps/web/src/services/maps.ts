// Единый конфиг карты для MapLibre + ProtoMaps CDN + локальные PMTiles адресов

// Режим карты:
// - 'pmtiles'  — “полноценный” векторный стиль (в нашем случае ProtoMaps CDN
//                или локальные pmtiles, если когда-нибудь появятся)
// - 'raster'   — временный растровый слой OSM (fallback)
export type MapStyleMode = 'pmtiles' | 'raster';

// В проде сюда может положиться значение через definePlugin / globalThis
declare const __ERM_MAP_STYLE_MODE__: MapStyleMode | undefined;

// Базовый стиль: ProtoMaps light для Украины
const DEFAULT_MAP_STYLE_URL =
  'https://api.protomaps.com/styles/v5/light/uk.json?key=e2ee205f93bfd080';

type MapStyleSource = 'default' | 'env';

type ImportMetaWithEnv = {
  readonly env?: {
    readonly VITE_MAP_STYLE_URL?: string;
    readonly VITE_MAP_ADDRESSES_PMTILES_URL?: string;
  };
};

/**
 * Читаем URL стиля карты:
 * 1) process.env.VITE_MAP_STYLE_URL (SSR / тесты)
 * 2) import.meta.env.VITE_MAP_STYLE_URL (Vite)
 * 3) DEFAULT_MAP_STYLE_URL (ProtoMaps CDN)
 */
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
    // import.meta может отсутствовать в тестах — это нормально
  }

  return { url: DEFAULT_MAP_STYLE_URL, source: 'default' };
};

/**
 * Читаем режим карты из глобальной переменной, если он задан билд-таймом.
 * (используется только если кто-то явно проставил __ERM_MAP_STYLE_MODE__).
 */
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

// ---- Публичные константы, которые используют остальные файлы ----

// URL стиля (по умолчанию — ProtoMaps CDN)
const mapStyle = readMapStyle();
export const MAP_STYLE_URL = mapStyle.url;

// “Полноценный” режим — всё, что НЕ tile.openstreetmap.org.
// Т.е. ProtoMaps CDN тоже считаем как полноценный векторный стиль.
const autoModeFromUrl = (url: string): MapStyleMode =>
  url.includes('tile.openstreetmap.org') ? 'raster' : 'pmtiles';

const runtimeMode = readRuntimeMapStyleMode();

// Итоговый режим:
//   - если есть глобальный __ERM_MAP_STYLE_MODE__ → берём его
//   - иначе определяем по URL (ProtoMaps → 'pmtiles', OSM raster → 'raster')
export const MAP_STYLE_MODE: MapStyleMode =
  runtimeMode ?? autoModeFromUrl(MAP_STYLE_URL);

// Флаг: используется ли именно наш дефолтный CDN-стиль ProtoMaps
export const MAP_STYLE_IS_DEFAULT = mapStyle.source === 'default';

// Совместимость со старыми импортами:
export const MAP_STYLE = MAP_STYLE_URL; // могли импортировать как MAP_STYLE
export const MAP_STYLE_DEFAULT_URL = DEFAULT_MAP_STYLE_URL;

// Атрибуция (Protomaps + OSM)
export const MAP_ATTRIBUTION =
  '© <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OSM contributors</a>';

// Центр/зум по умолчанию — Киев
export const MAP_DEFAULT_CENTER: [number, number] = [30.5234, 50.4501];
export const MAP_DEFAULT_ZOOM = 6;

// Глобальные границы мира (чтобы не улетать за пределы проекции)
export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-180, -85],
  [180, 85],
];

// Идентификатор векторного источника; для стиля Protomaps v5 — 'basemap'
export const MAP_VECTOR_SOURCE_ID = 'basemap';

// Скорость анимации (если используется для пробегов транспорта)
export const MAP_ANIMATION_SPEED_KMH = 50;

// ---- Локальный PMTiles с адресами (оставляем как есть) ----

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
    // отсутствие import.meta в тестах игнорируем
  }

  return '';
};

export const MAP_ADDRESSES_PMTILES_URL = readAddressTilesUrl();

// Дополнительные алиасы
export const DEFAULT_CENTER = MAP_DEFAULT_CENTER;
export const DEFAULT_ZOOM = MAP_DEFAULT_ZOOM;
