// Назначение: единая точка подключения MapLibre и поддержки протокола PMTiles
// Основные модули: maplibre-gl, pmtiles

import maplibregl, {
  type GeoJSONSource,
  type LngLatBoundsLike,
  type Listener,
  type Map as MapInstance,
  type MapLayerMouseEvent,
  type MapMouseEvent,
  type Marker as MapMarker,
  type ExpressionSpecification,
} from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

let pmtilesProtocolRegistered = false;

const registerPmtilesProtocol = () => {
  if (pmtilesProtocolRegistered) {
    return;
  }
  try {
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", (request) => protocol.tile(request));
    pmtilesProtocolRegistered = true;
  } catch (error) {
    console.error("Не удалось зарегистрировать протокол PMTiles", error);
  }
};

if (typeof window !== "undefined") {
  registerPmtilesProtocol();
}

export default maplibregl;
export { registerPmtilesProtocol };
export type {
  GeoJSONSource,
  LngLatBoundsLike,
  Listener,
  MapInstance,
  MapLayerMouseEvent,
  MapMouseEvent,
  MapMarker,
  ExpressionSpecification,
};
