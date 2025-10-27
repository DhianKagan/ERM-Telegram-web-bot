// Назначение: перенаправление типов Mapbox GL на реализации MapLibre
// Основные модули: maplibre-gl

declare module "mapbox-gl" {
  export * from "maplibre-gl";
  import maplibregl from "maplibre-gl";
  export default maplibregl;
}
