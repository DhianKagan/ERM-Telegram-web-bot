// Назначение файла: утилиты для геозон, расчёт метрик и проверка попадания точек
// Основные модули: Turf.js, GeoJSON
import type {
  Geometry,
  LineString,
  MultiLineString,
  Polygon,
  MultiPolygon,
  Feature,
} from 'geojson';
import {
  area as turfArea,
  buffer as turfBuffer,
  cleanCoords as turfCleanCoords,
  length as turfLength,
  point as turfPoint,
  polygonToLine as turfPolygonToLine,
  booleanPointInPolygon,
} from '@turf/turf';

export type GeoZoneGeometry = Polygon | MultiPolygon;
export type GeoZoneFeature = Feature<GeoZoneGeometry>;

export interface GeoZoneMetrics {
  areaKm2: number | null;
  perimeterKm: number | null;
  bufferMeters: number;
  bufferedGeometry: GeoZoneGeometry;
}

const SQUARE_METERS_IN_SQUARE_KILOMETER = 1_000_000;

export const DEFAULT_GEOZONE_BUFFER_METERS = 150;

export const isPolygonGeometry = (
  geometry: Geometry | null | undefined,
): geometry is GeoZoneGeometry => {
  if (!geometry) return false;
  return geometry.type === 'Polygon' || geometry.type === 'MultiPolygon';
};

const sumLineLength = (
  feature: Feature<LineString | MultiLineString>,
): number => turfLength(feature, { units: 'kilometers' });

export const computeGeoZoneMetrics = (
  feature: GeoZoneFeature,
  bufferMeters = DEFAULT_GEOZONE_BUFFER_METERS,
): GeoZoneMetrics => {
  const metrics: GeoZoneMetrics = {
    areaKm2: null,
    perimeterKm: null,
    bufferMeters,
    bufferedGeometry: feature.geometry,
  };

  try {
    const cleaned = turfCleanCoords(feature) as GeoZoneFeature;
    metrics.bufferedGeometry = cleaned.geometry;

    const areaSquareMeters = turfArea(cleaned);
    if (Number.isFinite(areaSquareMeters)) {
      metrics.areaKm2 = areaSquareMeters / SQUARE_METERS_IN_SQUARE_KILOMETER;
    }

    const boundary = turfPolygonToLine(cleaned);
    if (boundary.type === 'FeatureCollection') {
      let total = 0;
      for (const item of boundary.features) {
        if (!item || !item.geometry) continue;
        total += sumLineLength(item as Feature<LineString | MultiLineString>);
      }
      if (Number.isFinite(total)) {
        metrics.perimeterKm = total;
      }
    } else if (boundary.type === 'Feature' && boundary.geometry) {
      const value = sumLineLength(
        boundary as Feature<LineString | MultiLineString>,
      );
      if (Number.isFinite(value)) {
        metrics.perimeterKm = value;
      }
    }

    const buffered = turfBuffer(cleaned, bufferMeters, { units: 'meters' });
    if (buffered && isPolygonGeometry(buffered.geometry)) {
      metrics.bufferedGeometry = buffered.geometry;
    }
  } catch {
    // Игнорируем ошибки Turf, возвращаем максимально собранные метрики
  }

  return metrics;
};

export const pointWithinGeometry = (
  coordinates: [number, number],
  geometry: GeoZoneGeometry,
): boolean => {
  try {
    return booleanPointInPolygon(turfPoint(coordinates), {
      type: 'Feature',
      geometry,
      properties: {},
    });
  } catch {
    return false;
  }
};
