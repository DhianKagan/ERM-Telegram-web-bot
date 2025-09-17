// Назначение: заглушка типов для Leaflet в веб-приложении
// Модули: Leaflet

declare module "leaflet" {
  namespace L {
    type LatLngExpression =
      | [number, number]
      | [number, number, number]
      | { lat: number; lng: number; alt?: number };

    class Map {
      constructor(element: string | HTMLElement, options?: any);
      addLayer(layer: any): this;
      removeLayer(layer: any): this;
      remove(): void;
      setView(center: LatLngExpression, zoom: number): this;
      on(event: string, handler: (...args: any[]) => void): this;
    }

    class LayerGroup {
      constructor(layers?: any[]);
      addTo(map: Map): LayerGroup;
      addLayer(layer: any): LayerGroup;
      clearLayers(): void;
      remove(): void;
    }

    class TileLayer {
      constructor(urlTemplate: string, options?: any);
      addTo(map: Map): TileLayer;
    }

    class Marker {
      constructor(latlng: LatLngExpression, options?: any);
      addTo(target: Map | LayerGroup): Marker;
      bindPopup(html: string): Marker;
      bindTooltip(content: string, options?: any): Marker;
      on(event: string, handler: (...args: any[]) => void): Marker;
    }

    class Polyline {
      constructor(latlngs: LatLngExpression[] | LatLngExpression[][], options?: any);
      addTo(target: Map | LayerGroup): Polyline;
    }

    class Icon {
      constructor(options?: any);
    }

    function map(element: string | HTMLElement, options?: any): Map;
    function tileLayer(urlTemplate: string, options?: any): TileLayer;
    function layerGroup(layers?: any[]): LayerGroup;
    function marker(latlng: LatLngExpression, options?: any): Marker;
    function polyline(
      latlngs: LatLngExpression[] | LatLngExpression[][],
      options?: any,
    ): Polyline;
    function divIcon(options?: any): Icon;

    namespace control {
      function layers(...args: any[]): any;
    }
  }

  export = L;
}
