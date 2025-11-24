// Назначение файла: утилита для определения основного векторного источника в стиле карты
// Основные модули: maplibre-gl
import type { Map as MapInstance } from 'maplibre-gl';
import { MAP_VECTOR_SOURCE_ID } from '../config/map';

type MapStyleSource = { type?: string };

const isVectorSource = (source: MapStyleSource | undefined): boolean =>
  !!source && typeof source === 'object' && source.type === 'vector';

const pickFirstVectorSourceId = (
  sources: Record<string, MapStyleSource>,
): string | null => {
  for (const [sourceId, descriptor] of Object.entries(sources)) {
    if (isVectorSource(descriptor)) {
      return sourceId;
    }
  }
  return null;
};

export const detectPrimaryVectorSourceId = (
  map: MapInstance,
): string | null => {
  const style = map.getStyle();
  const sources = style?.sources;
  if (!sources || typeof sources !== 'object') {
    return null;
  }

  if (isVectorSource(sources[MAP_VECTOR_SOURCE_ID])) {
    return MAP_VECTOR_SOURCE_ID;
  }

  return pickFirstVectorSourceId(sources);
};
