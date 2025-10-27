// Назначение файла: заглушка типов GeoJSON для unit-тестов
// Основные модули: типы GeoJSON, используемые в компонентах логистики
export type Geometry = Record<string, unknown>;
export type GeoJsonProperties = Record<string, unknown> | null;
export type FeatureCollection<
  G extends Geometry = Geometry,
  P extends GeoJsonProperties = GeoJsonProperties,
> = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: G;
    properties: P;
  }>;
};
