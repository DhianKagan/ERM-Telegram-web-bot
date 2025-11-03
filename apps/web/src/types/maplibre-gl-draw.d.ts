// Назначение: типы для библиотеки maplibre-gl-draw
// Основные модули: maplibre-gl-draw, maplibre-gl, geojson

import type { Feature, FeatureCollection } from "geojson";
import type { Map as MapInstance } from "maplibre-gl";

declare module "maplibre-gl-draw" {
  export interface MapLibreDrawControls {
    point?: boolean;
    line_string?: boolean;
    polygon?: boolean;
    trash?: boolean;
    combine_features?: boolean;
    uncombine_features?: boolean;
  }

  export type MapLibreDrawLayer = Parameters<MapInstance["addLayer"]>[0];

  export interface MapLibreDrawOptions {
    defaultMode?: string;
    displayControlsDefault?: boolean;
    controls?: MapLibreDrawControls;
    styles?: ReadonlyArray<MapLibreDrawLayer>;
    userProperties?: boolean;
  }

  export default class MapLibreDraw {
    constructor(options?: MapLibreDrawOptions);
    addTo(map: MapInstance): this;
    changeMode(mode: string): void;
    delete(id: string | string[]): Feature[] | undefined;
    deleteAll(): FeatureCollection | undefined;
    get(id: string | string[]): Feature | undefined;
    getAll(): FeatureCollection;
    getMode(): string;
    set(data: FeatureCollection): void;
    setFeatureProperty(id: string, property: string, value: unknown): void;
    trash(): void;
    on(event: string, handler: (...args: unknown[]) => void): void;
    off(event: string, handler: (...args: unknown[]) => void): void;
  }

  export { MapLibreDrawOptions };
}
