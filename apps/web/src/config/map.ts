// Map config unified for MapLibre + Protomaps CDN

type MapStyleMode = 'pmtiles' | 'raster';

declare const __ERM_MAP_STYLE_MODE__: MapStyleMode | undefined;

// По умолчанию используем векторный стиль OpenFreeMap
const DEFAULT_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_RASTER_STYLE_URL =
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

type MapStyleSource = 'default' | 'env';

type ImportMetaWithEnv = {
  readonly env?: {
    readonly VITE_MAP_STYLE_URL?: string;
    readonly VITE_MAP_ADDRESSES_PMTILES_URL?: string;
  };
};

type AddressTilesSource = 'env' | 'local' | 'missing';

const readImportMetaEnv = (): ImportMetaWithEnv['env'] | undefined =>
  (globalThis as { __ERM_IMPORT_META_ENV__?: ImportMetaWithEnv['env'] })
    .__ERM_IMPORT_META_ENV__;

const LOCAL_ADDRESS_PMTILES_PATH = 'pmtiles://tiles/addresses.pmtiles';

const hasLocalAddressTiles = (() => {
  if (typeof window !== 'undefined') {
    return true;
  }
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs') as typeof import('node:fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('node:path') as typeof import('node:path');
      const localPath = path.resolve(
        process.cwd(),
        'apps/web/public/tiles/addresses.pmtiles',
      );
      return fs.existsSync(localPath);
    } catch {
      return false;
    }
  }
  return false;
})();

// Читаем URL стиля: сначала пытаемся взять из process.env (сервер), потом из import.meta.env (клиент), иначе используем DEFAULT_MAP_STYLE_URL
const readMapStyle = (): { url: string; source: MapStyleSource } => {
  const processValue =
    typeof process !== 'undefined' && typeof process.env === 'object'
      ? process.env.VITE_MAP_STYLE_URL
      : undefined;
  if (typeof processValue === 'string' && processValue.trim() !== '') {
    return { url: processValue.trim(), source: 'env' };
  }
  const meta = readImportMetaEnv();
  const metaValue = meta?.VITE_MAP_STYLE_URL;
  if (typeof metaValue === 'string' && metaValue.trim() !== '') {
    return { url: metaValue, source: 'env' };
  }
  return { url: DEFAULT_MAP_STYLE_URL, source: 'default' };
};

// Считываем режим стиля, который можно установить через глобальную переменную __ERM_MAP_STYLE_MODE__
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

// URL стиля — можно переопределить через VITE_MAP_STYLE_URL
const mapStyle = readMapStyle();
export const MAP_STYLE_URL = mapStyle.url;
const runtimeMode = readRuntimeMapStyleMode();
const isCustomStyle = mapStyle.source === 'env';

const autoModeFromUrl = (url: string): MapStyleMode =>
  url.includes('tile.openstreetmap.org') ? 'raster' : 'pmtiles';

// Совместимость с существующими импортами:
export const MAP_STYLE = MAP_STYLE_URL; // ранее могли импортировать как MAP_STYLE
export const MAP_STYLE_DEFAULT_URL = DEFAULT_MAP_STYLE_URL;
export const MAP_RASTER_STYLE_URL = DEFAULT_RASTER_STYLE_URL;
export const MAP_STYLE_MODE: MapStyleMode = (() => {
  if (runtimeMode) return runtimeMode;
  if (isCustomStyle) return 'pmtiles';
  return autoModeFromUrl(MAP_STYLE_URL);
})();
export const MAP_STYLE_IS_DEFAULT = mapStyle.source === 'default';

// Атрибуция (OpenFreeMap + участники OpenStreetMap)
export const MAP_ATTRIBUTION =
  '© <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">участники OpenStreetMap</a>';

// Центр/зум по умолчанию — Киев
export const MAP_DEFAULT_CENTER: [number, number] = [30.5234, 50.4501];
export const MAP_DEFAULT_ZOOM = 6;

// Глобальные границы мира (чтобы не улетать за пределы проекции)
export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-180, -85],
  [180, 85],
];

// Идентификатор векторного источника; для стиля Protomaps v5 чаще 'basemap'
export const MAP_VECTOR_SOURCE_ID = 'basemap';

// Скорость анимации (если используется для пробегов транспорта)
export const MAP_ANIMATION_SPEED_KMH = 50;

// Локальный путь к адресным PMTiles. Можно переопределить через VITE_MAP_ADDRESSES_PMTILES_URL
const readAddressTilesUrl = (): {
  url: string | null;
  source: AddressTilesSource;
} => {
  const processValue =
    typeof process !== 'undefined' && typeof process.env === 'object'
      ? process.env.VITE_MAP_ADDRESSES_PMTILES_URL
      : undefined;
  if (typeof processValue === 'string' && processValue.trim() !== '') {
    return { url: processValue.trim(), source: 'env' };
  }
  const meta = readImportMetaEnv();
  const metaValue = meta?.VITE_MAP_ADDRESSES_PMTILES_URL;
  if (typeof metaValue === 'string' && metaValue.trim() !== '') {
    return { url: metaValue.trim(), source: 'env' };
  }
  if (hasLocalAddressTiles) {
    return { url: LOCAL_ADDRESS_PMTILES_PATH, source: 'local' };
  }
  console.error(
    'Ошибка конфигурации: адресные плитки не найдены. Установите VITE_MAP_ADDRESSES_PMTILES_URL=pmtiles://tiles/addresses.pmtiles и проверьте наличие файла apps/web/public/tiles/addresses.pmtiles.',
  );
  return { url: null, source: 'missing' };
};

// Экспортируем URL адресных плит (pmtiles://...), либо пустую строку
const addressTilesConfig = readAddressTilesUrl();
export const MAP_ADDRESSES_PMTILES_URL = addressTilesConfig.url ?? '';
export const MAP_ADDRESSES_PMTILES_SOURCE = addressTilesConfig.source;

// Дополнительные алиасы (если где-то использовались короткие имена)
export const DEFAULT_CENTER = MAP_DEFAULT_CENTER;
export const DEFAULT_ZOOM = MAP_DEFAULT_ZOOM;
