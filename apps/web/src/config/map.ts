// apps/web/src/config/map.ts
// Minimal map config stub for deployments WITHOUT local tiles.
// Exports same names as full config but with safe defaults.

export type MapStyleMode = 'pmtiles' | 'raster';

export const MAP_STYLE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAP_STYLE_DEFAULT_URL = MAP_STYLE_URL;
export const MAP_RASTER_STYLE_URL = MAP_STYLE_URL;

// If you do not use pmtiles, set mode to raster.
export const MAP_STYLE_MODE = 'raster' as const satisfies MapStyleMode;
export const MAP_STYLE_IS_DEFAULT = true;

export const MAP_ADDRESSES_PMTILES_URL = '';
export const MAP_ADDRESSES_PMTILES_SOURCE = 'missing' as const;

export const MAP_ATTRIBUTION = '© OpenStreetMap contributors';

export const MAP_DEFAULT_CENTER = [30.5234, 50.4501] as const;
export const MAP_DEFAULT_ZOOM = 6;
export const MAP_MAX_BOUNDS = [
  [-180, -85],
  [180, 85],
] as const;
