// Назначение: типы MapLibre GL и MapLibre Draw для веб-клиента
// Модули: maplibre-gl, @mapbox/mapbox-gl-draw

declare module "maplibre-gl" {
  import type { Feature, FeatureCollection, Geometry } from "geojson";

  export type LngLatLike =
    | [number, number]
    | { lng: number; lat: number }
    | LngLat;

  export class LngLat {
    constructor(lng: number, lat: number);
    readonly lng: number;
    readonly lat: number;
    toArray(): [number, number];
    toBounds(radius: number): LngLatBounds;
    wrap(): LngLat;
    static convert(input: LngLatLike): LngLat;
  }

  export class LngLatBounds {
    constructor(southWest: LngLatLike, northEast?: LngLatLike);
    extend(lngLat: LngLatLike): this;
    getSouthWest(): LngLat;
    getNorthEast(): LngLat;
    toArray(): [LngLat, LngLat];
  }

  export type ControlPosition =
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";

  export interface IControl {
    onAdd(map: Map): HTMLElement;
    onRemove(map: Map): void;
    getDefaultPosition?(): ControlPosition;
  }

  export interface NavigationControlOptions {
    visualizePitch?: boolean;
    showZoom?: boolean;
    showCompass?: boolean;
  }

  export class NavigationControl implements IControl {
    constructor(options?: NavigationControlOptions);
    onAdd(map: Map): HTMLElement;
    onRemove(): void;
    getDefaultPosition?(): ControlPosition;
  }

  export type Anchor =
    | "center"
    | "left"
    | "right"
    | "top"
    | "bottom"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";

  export interface MarkerOptions {
    element?: HTMLElement;
    anchor?: Anchor;
    draggable?: boolean;
    offset?: [number, number];
    color?: string;
    scale?: number;
  }

  export class Marker {
    constructor(options?: MarkerOptions);
    setLngLat(lngLat: LngLatLike): this;
    getLngLat(): LngLat;
    addTo(map: Map): this;
    remove(): this;
    setPopup(popup: Popup): this;
    togglePopup(): this;
    setDraggable(value: boolean): this;
  }

  export interface PopupOptions {
    closeButton?: boolean;
    closeOnClick?: boolean;
    maxWidth?: string;
    offset?: number | [number, number] | Record<Anchor, [number, number]>;
  }

  export class Popup {
    constructor(options?: PopupOptions);
    setLngLat(lngLat: LngLatLike): this;
    setHTML(html: string): this;
    addTo(map: Map): this;
    remove(): this;
  }

  export interface MapOptions {
    container: string | HTMLElement;
    style: string | Record<string, unknown>;
    center?: LngLatLike;
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    attributionControl?: boolean;
    hash?: boolean;
    [key: string]: unknown;
  }

  export interface MapboxEventBase<TTarget = Map> {
    type: string;
    target: TTarget;
  }

  export interface MapMouseEvent extends MapboxEventBase {
    lngLat: LngLat;
    point: { x: number; y: number };
    originalEvent: MouseEvent;
  }

  export type GeoJSONFeature = Feature<Geometry, Record<string, unknown>>;
  export type GeoJSONFeatureCollection = FeatureCollection<
    Geometry,
    Record<string, unknown>
  >;

  export interface MapLayerMouseEvent extends MapMouseEvent {
    features?: GeoJSONFeature[];
  }

  export type MapEvent = MapMouseEvent | MapLayerMouseEvent;
  export type MapEventListener = (event: MapEvent) => void;

  export interface GeoJSONSourceSpecification {
    type: "geojson";
    data: string | GeoJSONFeature | GeoJSONFeatureCollection;
    cluster?: boolean;
    clusterRadius?: number;
    promoteId?: string | Record<string, string>;
    [key: string]: unknown;
  }

  export class GeoJSONSource {
    setData(data: string | GeoJSONFeature | GeoJSONFeatureCollection): void;
    getClusterExpansionZoom?(
      clusterId: number,
      callback: (error: Error | null, zoom: number) => void,
    ): void;
  }

  export interface LayerSpecification {
    id: string;
    type: string;
    source: string;
    sourceLayer?: string;
    paint?: Record<string, unknown>;
    layout?: Record<string, unknown>;
    filter?: unknown[];
    metadata?: Record<string, unknown>;
  }

  export type AnyLayer = LayerSpecification;
  export type AnySourceData = GeoJSONSourceSpecification;

  export class Map {
    constructor(options: MapOptions);
    addControl(control: IControl, position?: ControlPosition): this;
    removeControl(control: IControl): this;
    addSource(id: string, source: GeoJSONSourceSpecification): this;
    getSource(id: string): GeoJSONSource | undefined;
    removeSource(id: string): this;
    addLayer(layer: LayerSpecification, beforeId?: string): this;
    removeLayer(id: string): this;
    getCanvas(): HTMLCanvasElement;
    getCanvasContainer(): HTMLElement;
    getContainer(): HTMLElement;
    getStyle(): Record<string, unknown> | undefined;
    setPaintProperty(layerId: string, name: string, value: unknown): this;
    setFilter(layerId: string, filter?: unknown[]): this;
    setLayoutProperty(layerId: string, name: string, value: unknown): this;
    project(lngLat: LngLatLike): { x: number; y: number };
    unproject(point: { x: number; y: number }): LngLat;
    on(type: string, listener: MapEventListener): this;
    on(type: string, layerId: string, listener: MapEventListener): this;
    off(type: string, listener: MapEventListener): this;
    off(type: string, layerId: string, listener: MapEventListener): this;
    once(type: string, listener: MapEventListener): this;
    once(type: string, layerId: string, listener: MapEventListener): this;
    fitBounds(bounds: LngLatBounds | [LngLatLike, LngLatLike], options?: Record<string, unknown>): this;
    getBounds(): LngLatBounds;
    setCenter(center: LngLatLike): this;
    setZoom(zoom: number): this;
    remove(): void;
  }

  export class AttributionControl implements IControl {
    constructor(options?: Record<string, unknown>);
    onAdd(map: Map): HTMLElement;
    onRemove(): void;
  }

  export default Map;
}

declare module "@mapbox/mapbox-gl-draw" {
  import type { Feature, FeatureCollection, Geometry } from "geojson";
  import type { IControl, Map } from "maplibre-gl";

  export type DrawModeControl =
    | "point"
    | "line_string"
    | "polygon"
    | "trash"
    | "combine_features"
    | "uncombine_features";

  export type DrawFeature = Feature<Geometry, Record<string, unknown>>;
  export type DrawFeatureCollection = FeatureCollection<
    Geometry,
    Record<string, unknown>
  >;

  export interface MapboxDrawOptions {
    displayControlsDefault?: boolean;
    controls?: Partial<Record<DrawModeControl, boolean>>;
    defaultMode?: string;
    userProperties?: boolean;
    styles?: unknown[];
    modes?: Record<string, unknown>;
  }

  export default class MapboxDraw implements IControl {
    constructor(options?: MapboxDrawOptions);
    onAdd(map: Map): HTMLElement;
    onRemove(map: Map): void;
    getDefaultPosition?(): import("maplibre-gl").ControlPosition;
    add(feature: DrawFeature | DrawFeatureCollection): string | string[];
    set(featureCollection: DrawFeatureCollection): this;
    get(featureId: string): DrawFeature | null;
    getAll(): DrawFeatureCollection;
    getSelected(): DrawFeatureCollection;
    changeMode(mode: string, options?: Record<string, unknown>): this;
    getMode(): string;
    delete(id: string | string[]): this;
    deleteAll(): this;
    setFeatureProperty(id: string, property: string, value: unknown): this;
  }
}

declare module "@maplibre/maplibre-gl-draw" {
  export {
    default,
    type MapboxDrawOptions as MaplibreGlDrawOptions,
    type DrawFeature,
    type DrawFeatureCollection,
    type DrawModeControl,
  } from "@mapbox/mapbox-gl-draw";
}
