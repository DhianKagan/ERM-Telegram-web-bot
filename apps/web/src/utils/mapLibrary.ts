// Назначение: единая точка подключения MapLibre и поддержки протокола PMTiles
// Основные модули: maplibre-gl, pmtiles

import maplibregl, {
  type GeoJSONSource,
  type LngLatBoundsLike,
  type Listener,
  type Map as MapInstance,
  type MapLayerMouseEvent,
  type MapMouseEvent,
  type Marker as MapMarker,
  type ExpressionSpecification,
  type MapOptions,
} from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_STYLE_DEFAULT_URL } from '../config/map';

let pmtilesProtocolRegistered = false;

const registerPmtilesProtocol = () => {
  if (pmtilesProtocolRegistered) {
    return;
  }
  try {
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', (request) => protocol.tile(request));
    pmtilesProtocolRegistered = true;
  } catch (error) {
    console.error('Не удалось зарегистрировать протокол PMTiles', error);
  }
};

if (typeof window !== 'undefined') {
  registerPmtilesProtocol();
}

type MapStyleError = {
  status?: number;
  url?: string;
  message?: string;
};

type MapErrorEvent = {
  error?: MapStyleError | null;
};

type MapStyleFallbackOptions = {
  initialStyle?: MapOptions['style'];
  fallbackUrl?: string;
  logger?: Pick<typeof console, 'warn'>;
};

const noopDetach = () => {};

export const attachMapStyleFallback = (
  map: MapInstance | null,
  options: MapStyleFallbackOptions = {},
): (() => void) => {
  if (!map) {
    return noopDetach;
  }
  const initialStyle =
    typeof options.initialStyle === 'string' ? options.initialStyle : '';
  const fallbackUrl =
    typeof options.fallbackUrl === 'string'
      ? options.fallbackUrl
      : MAP_STYLE_DEFAULT_URL;
  if (!initialStyle || !fallbackUrl || initialStyle === fallbackUrl) {
    return noopDetach;
  }
  const logger = options.logger ?? console;
  let fallbackApplied = false;

  const handleError = (event: MapErrorEvent) => {
    if (fallbackApplied) {
      return;
    }
    const error = event?.error;
    if (!error) {
      return;
    }
    const url = typeof error.url === 'string' ? error.url : '';
    if (url && url !== initialStyle) {
      return;
    }
    const status = typeof error.status === 'number' ? error.status : undefined;
    const message = typeof error.message === 'string' ? error.message : '';
    const isStyleFailure =
      (message && message.toLowerCase().includes('style')) ||
      url === initialStyle ||
      (typeof status === 'number' && status >= 400);
    if (!isStyleFailure) {
      return;
    }
    fallbackApplied = true;
    logger.warn(
      'Не удалось загрузить кастомный стиль карты, используем стиль по умолчанию.',
      error,
    );
    try {
      map.setStyle(fallbackUrl, { diff: false });
    } catch (setStyleError) {
      console.error('Не удалось применить стиль по умолчанию', setStyleError);
    }
  };

  map.on('error', handleError);
  return () => {
    map.off('error', handleError);
  };
};

export default maplibregl;
export { registerPmtilesProtocol };
export type {
  GeoJSONSource,
  LngLatBoundsLike,
  Listener,
  MapInstance,
  MapLayerMouseEvent,
  MapMouseEvent,
  MapMarker,
  ExpressionSpecification,
};
