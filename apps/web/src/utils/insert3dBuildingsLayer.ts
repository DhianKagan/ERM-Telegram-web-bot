// Назначение файла: добавление 3D-слоя зданий и обеспечение корректного порядка слоёв на карте
// Основные модули: maplibre-gl
import type { Map as MapInstance } from 'maplibre-gl';
import {
  detectPrimaryVectorSourceId,
  findFirstVectorSourceId,
} from './vectorSource';

export const BUILDINGS_LAYER_ID = 'logistics-3d-buildings';

type AnyLayerSpecification = Parameters<MapInstance['addLayer']>[0];
type FillExtrusionLayerSpecification = Extract<
  AnyLayerSpecification,
  { type: 'fill-extrusion' }
>;
type SymbolLayerSpecification = Extract<
  AnyLayerSpecification,
  { type: 'symbol' }
>;

export const insert3dBuildingsLayer = (map: MapInstance): string | null => {
  const vectorSourceId =
    detectPrimaryVectorSourceId(map) ?? findFirstVectorSourceId(map);

  if (!vectorSourceId) {
    console.warn(
      '3D-слой зданий пропущен: в стиле нет доступных векторных источников.',
    );
    return null;
  }

  const style = map.getStyle();

  const layers = (style?.layers ?? []) as AnyLayerSpecification[];
  const labelLayer = layers.find((layer): layer is SymbolLayerSpecification => {
    if (!layer || layer.type !== 'symbol') {
      return false;
    }
    const layout = layer.layout;
    if (!layout) {
      return false;
    }
    const textField = layout['text-field'];
    return typeof textField === 'string' || Array.isArray(textField);
  });

  const createBuildingsLayer = (): FillExtrusionLayerSpecification => ({
    id: BUILDINGS_LAYER_ID,
    type: 'fill-extrusion',
    source: vectorSourceId,
    'source-layer': 'building',
    filter: ['==', ['get', 'extrude'], 'true'],
    minzoom: 15,
    paint: {
      'fill-extrusion-color': '#94a3b8',
      'fill-extrusion-height': [
        'interpolate',
        ['linear'],
        ['zoom'],
        15,
        0,
        15.05,
        ['coalesce', ['get', 'height'], 0],
      ],
      'fill-extrusion-base': [
        'interpolate',
        ['linear'],
        ['zoom'],
        15,
        0,
        15.05,
        ['coalesce', ['get', 'min_height'], 0],
      ],
      'fill-extrusion-opacity': 0.6,
    },
  });

  const targetLayerId = BUILDINGS_LAYER_ID;
  const beforeLayerId = labelLayer?.id ?? null;
  const existingLayer = map.getLayer(targetLayerId);

  if (!existingLayer) {
    const buildingsLayer = createBuildingsLayer();
    try {
      map.addLayer(buildingsLayer, beforeLayerId ?? undefined);
    } catch (_error) {
      void _error;
      return beforeLayerId;
    }
  } else if (beforeLayerId) {
    map.moveLayer(targetLayerId, beforeLayerId);
  }

  return beforeLayerId;
};
