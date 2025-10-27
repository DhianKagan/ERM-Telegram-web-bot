// Назначение: перенаправление типов Mapbox Draw на пакет maplibre-gl-draw
// Основные модули: mapbox__mapbox-gl-draw

declare module "maplibre-gl-draw" {
  import MapboxDraw = require("@mapbox/mapbox-gl-draw");
  export = MapboxDraw;
}
