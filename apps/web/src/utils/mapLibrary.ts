// Назначение: выбор и настройка реализации карт (Mapbox GL или MapLibre GL)
// Основные модули: mapbox-gl, maplibre-gl

import mapboxglOriginal, {
  type GeoJSONSource,
  type LngLatBoundsLike,
  type Map as MapInstance,
  type MapLayerMouseEvent,
  type MapMouseEvent,
  type Marker as MapMarker,
} from "mapbox-gl";
import maplibregl from "maplibre-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  MAPBOX_ACCESS_TOKEN,
  MAP_STYLE_FALLBACK_USED,
} from "../config/map";

mapboxglOriginal.accessToken = MAPBOX_ACCESS_TOKEN;

const mapImplementation: typeof mapboxglOriginal = MAP_STYLE_FALLBACK_USED
  ? (maplibregl as unknown as typeof mapboxglOriginal)
  : mapboxglOriginal;

export const mapboxgl = mapboxglOriginal;
export default mapImplementation;
export type {
  GeoJSONSource,
  LngLatBoundsLike,
  MapInstance,
  MapLayerMouseEvent,
  MapMouseEvent,
  MapMarker,
};
