// Назначение файла: заглушка типов GeoJSON для unit-тестов
// Основные модули: типы GeoJSON, используемые в компонентах логистики

type Position = number[];

type PointGeometry = {
  type: "Point";
  coordinates: Position;
};

type MultiPointGeometry = {
  type: "MultiPoint";
  coordinates: Position[];
};

type LineStringGeometry = {
  type: "LineString";
  coordinates: Position[];
};

type MultiLineStringGeometry = {
  type: "MultiLineString";
  coordinates: Position[][];
};

type PolygonGeometry = {
  type: "Polygon";
  coordinates: Position[][];
};

type MultiPolygonGeometry = {
  type: "MultiPolygon";
  coordinates: Position[][][];
};

type GeometryCollection = {
  type: "GeometryCollection";
  geometries: Geometry[];
};

export type Geometry =
  | PointGeometry
  | MultiPointGeometry
  | LineStringGeometry
  | MultiLineStringGeometry
  | PolygonGeometry
  | MultiPolygonGeometry
  | GeometryCollection;

export type GeoJsonProperties = Record<string, unknown> | null;

type BBox2D = [number, number, number, number];
type BBox3D = [number, number, number, number, number, number];
export type BBox = BBox2D | BBox3D;

export type Feature<
  G extends Geometry = Geometry,
  P extends GeoJsonProperties = GeoJsonProperties,
> = {
  type: "Feature";
  geometry: G;
  properties: P;
  id?: string | number;
  bbox?: BBox;
};

export type FeatureCollection<
  G extends Geometry = Geometry,
  P extends GeoJsonProperties = GeoJsonProperties,
> = {
  type: "FeatureCollection";
  features: Array<Feature<G, P>>;
  bbox?: BBox;
};
