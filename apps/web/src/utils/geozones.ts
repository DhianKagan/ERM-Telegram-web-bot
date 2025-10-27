// Назначение: утилиты для работы с геозонами (GeoJSON)
// Модули: geojson
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
} from "geojson";

type PolygonLikeGeometry = { type: "Polygon" | "MultiPolygon" };

export type GeozoneGeometry = Extract<Geometry, PolygonLikeGeometry>;
export type GeozoneFeature = Feature<GeozoneGeometry, GeoJsonProperties>;
export type GeozoneFeatureCollection = FeatureCollection<GeozoneGeometry, GeoJsonProperties>;

export const EMPTY_GEOZONE_COLLECTION: GeozoneFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const POLYGON_TYPES = new Set<Geometry["type"]>(["Polygon", "MultiPolygon"]);

export const cloneGeozoneCollection = (
  source?: GeozoneFeatureCollection | null,
): GeozoneFeatureCollection => {
  if (!source) {
    return { ...EMPTY_GEOZONE_COLLECTION, features: [] };
  }
  return JSON.parse(JSON.stringify(source)) as GeozoneFeatureCollection;
};

export const isPolygonFeature = (
  feature: GeozoneFeatureCollection["features"][number],
): feature is GeozoneFeature => {
  if (!feature || typeof feature !== "object") {
    return false;
  }
  const geometry = feature.geometry;
  if (!geometry || typeof geometry !== "object") {
    return false;
  }
  return POLYGON_TYPES.has(geometry.type);
};

export const hasPolygonGeometry = (collection: GeozoneFeatureCollection): boolean =>
  collection.features.some(isPolygonFeature);

export const areGeozoneCollectionsEqual = (
  left: GeozoneFeatureCollection,
  right: GeozoneFeatureCollection,
): boolean => {
  if (left.features.length !== right.features.length) {
    return false;
  }
  for (let index = 0; index < left.features.length; index += 1) {
    const leftFeature = left.features[index];
    const rightFeature = right.features[index];
    if (!leftFeature || !rightFeature) {
      return false;
    }
    if (JSON.stringify(leftFeature) !== JSON.stringify(rightFeature)) {
      return false;
    }
  }
  return true;
};

export const sanitizeGeozoneCollection = (
  input: unknown,
): GeozoneFeatureCollection => {
  if (!input) {
    return EMPTY_GEOZONE_COLLECTION;
  }
  const normalize = (value: unknown): GeozoneFeatureCollection | null => {
    if (!value || typeof value !== "object") {
      return null;
    }
    const candidate = value as Record<string, unknown>;
    if (candidate.type !== "FeatureCollection") {
      return null;
    }
    const rawFeatures = candidate.features;
    if (!Array.isArray(rawFeatures)) {
      return null;
    }
    const features = rawFeatures.filter(isPolygonFeature);
    return { type: "FeatureCollection", features };
  };
  const direct = normalize(input);
  if (direct) {
    return cloneGeozoneCollection(direct);
  }
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      const parsedCollection = normalize(parsed);
      if (parsedCollection) {
        return cloneGeozoneCollection(parsedCollection);
      }
    } catch {
      return EMPTY_GEOZONE_COLLECTION;
    }
  }
  return EMPTY_GEOZONE_COLLECTION;
};
