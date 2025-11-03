// Назначение: стаб MapLibre для unit-тестов.
// Основные модули: нет.

class StubMap {
  addControl(): this {
    return this;
  }

  remove(): void {}

  on(): this {
    return this;
  }

  off(): this {
    return this;
  }

  easeTo(): this {
    return this;
  }

  getZoom(): number {
    return 0;
  }

  setZoom(): this {
    return this;
  }

  fitBounds(): this {
    return this;
  }

  addSource(): this {
    return this;
  }

  getSource(): unknown {
    return undefined;
  }

  addLayer(): this {
    return this;
  }

  removeLayer(): this {
    return this;
  }

  removeSource(): this {
    return this;
  }
}

class StubMarker {
  setLngLat(): this {
    return this;
  }

  addTo(): this {
    return this;
  }

  remove(): void {}
}

const addProtocol = () => undefined;

const maplibregl = {
  Map: StubMap,
  Marker: StubMarker,
  NavigationControl: class {},
  AttributionControl: class {},
  addProtocol,
};

export default maplibregl;
export { StubMap as Map, StubMarker as Marker, addProtocol };
export type GeoJSONSource = Record<string, unknown>;
export type LngLatBoundsLike = [number, number, number, number];
export type MapInstance = StubMap;
export type MapLayerMouseEvent = Record<string, unknown>;
export type MapMouseEvent = Record<string, unknown>;
export type MapMarker = StubMarker;
