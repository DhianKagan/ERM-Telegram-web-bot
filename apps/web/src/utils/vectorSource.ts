// Назначение файла: утилита для определения основного векторного источника в стиле карты
// Основные модули: maplibre-gl
import type { Map as MapInstance } from 'maplibre-gl';
import { MAP_VECTOR_SOURCE_IDS } from '../config/map';

type MapStyleSource = { type?: string };

const isVectorSource = (source: MapStyleSource | undefined): boolean =>
  !!source && typeof source === 'object' && source.type === 'vector';

const resolveSources = (
  map: MapInstance,
): Record<string, MapStyleSource> | null => {
  const style = map.getStyle();
  const sources = style?.sources;
  if (!sources || typeof sources !== 'object') {
    return null;
  }

  return sources;
};

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

export const findFirstVectorSourceId = (map: MapInstance): string | null => {
  const sources = resolveSources(map);
  if (!sources) {
    return null;
  }

  return pickFirstVectorSourceId(sources);
};

export const detectPrimaryVectorSourceId = (
  map: MapInstance,
): string | null => {
  const sources = resolveSources(map);
  if (!sources) {
    return null;
  }

  for (const candidate of MAP_VECTOR_SOURCE_IDS) {
    if (isVectorSource(sources[candidate])) {
      return candidate;
    }
  }

  return null;
};
