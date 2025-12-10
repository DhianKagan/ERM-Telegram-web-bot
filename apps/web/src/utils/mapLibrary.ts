// apps/web/src/utils/mapLibrary.ts
// No-op pmtiles + fallback utilities for deployments without tiles.

import maplibregl from 'maplibre-gl';

// registerPmtilesProtocol intentionally disabled for deployments without local tiles.
const registerPmtilesProtocol = async (): Promise<boolean> => {
  return false;
};

// attachMapStyleFallback: keep a minimal implementation so imports keep working.
// Returns a detach function.
export const attachMapStyleFallback = (_map: unknown, _options: unknown = {}): (() => void) => {
  // noop - no fallback wiring
  return () => {};
};

// RASTER_FALLBACK_STYLE-like minimal export so other modules can import it if needed.
export const RASTER_FALLBACK_STYLE = {
  version: 8,
  sources: {
    'osm-raster': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm-raster', type: 'raster', source: 'osm-raster' }],
} as const;

export default maplibregl;
export { registerPmtilesProtocol };
export type {
  // keep exported types names to avoid type errors in dependents
  GeoJSONSource,
  LngLatBoundsLike,
  Listener,
  Map as MapInstance,
  MapLayerMouseEvent,
  MapMouseEvent,
  Marker as MapMarker,
  ExpressionSpecification,
  AttributionControl,
} from 'maplibre-gl';
