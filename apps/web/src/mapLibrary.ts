// apps/web/src/utils/mapLibrary.ts
/**
 * Unified helper for MapLibre + PMTiles protocol.
 *
 * Правки:
 * - pmtiles динамически импортируется в браузере, чтобы избежать проблем на стадии билда/SSR.
 * - maplibre-gl CSS загружается только в браузере.
 * - Экспортируются registerPmtilesProtocol и attachMapStyleFallback.
 */

import maplibregl, {
  type GeoJSONSource,
  type LngLatBoundsLike,
  type Listener,
  type StyleSpecification,
  type Map as MapInstance,
  type MapLayerMouseEvent,
  type MapMouseEvent,
  type Marker as MapMarker,
  type RequestParameters,
  type ResponseCallback,
  type ExpressionSpecification,
  type MapOptions,
} from 'maplibre-gl';

import {
  MAP_ATTRIBUTION,
  MAP_RASTER_STYLE_URL,
  MAP_STYLE_DEFAULT_URL,
} from './config/map';

// Не импортируем pmtiles статически: const { Protocol } from 'pmtiles'; <- это ломает билд в некоторых средах.

// Загружаем CSS только в браузере (динамический импорт, чтобы сборщик не подхватывал css во время node/ssr)
if (typeof document !== 'undefined') {
  // Попробуем динамически импортировать css (Vite поддерживает), и при ошибке — fallback с <link>
  void import('maplibre-gl/dist/maplibre-gl.css').catch(() => {
    try {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      // В большинстве случаев это будет работать; это fallback если динамический импорт css не сработал.
      link.href = new URL(
        'maplibre-gl/dist/maplibre-gl.css',
        location.href,
      ).href;
      document.head.appendChild(link);
    } catch {
      // бессильно — просто игнорируем
    }
  });
}

let pmtilesProtocolRegistered = false;

/**
 * Регистрация протокола pmtiles — ДИНАМИЧЕСКИ и ТОЛЬКО в браузере.
 * Это предотвращает попытки бандлера/SSR включать node-only зависимости.
 */
const registerPmtilesProtocol = async (): Promise<boolean> => {
  if (pmtilesProtocolRegistered) return true;
  if (typeof window === 'undefined') return false; // только в браузере

  try {
    // Динамически загружаем пакет pmtiles
    type PmtilesProtocol = {
      tile: (
        request: RequestParameters,
        callback: ResponseCallback<ArrayBuffer | null>,
      ) => { cancel?: () => void };
    };
    type PmtilesModule = {
      Protocol?: new () => PmtilesProtocol;
      default?: new () =>
        | PmtilesProtocol
        | { Protocol?: new () => PmtilesProtocol };
    };
    const mod = (await import('pmtiles')) as PmtilesModule;

    const resolveProtocolCtor = (
      module: PmtilesModule,
    ): (new () => PmtilesProtocol) | null => {
      if (typeof module.Protocol === 'function') {
        return module.Protocol;
      }
      const fallback = module.default;
      if (typeof fallback === 'function') {
        return fallback;
      }
      if (
        fallback &&
        typeof fallback === 'object' &&
        typeof (fallback as { Protocol?: unknown }).Protocol === 'function'
      ) {
        return (fallback as { Protocol: new () => PmtilesProtocol }).Protocol;
      }
      return null;
    };

    const ProtocolCtor = resolveProtocolCtor(mod);

    if (typeof ProtocolCtor !== 'function') {
      console.error(
        'pmtiles Protocol constructor not found in dynamic import',
        mod,
      );
      return false;
    }

    const protocol = new ProtocolCtor();

    // maplibregl может не иметь addProtocol в некоторых сборках — защитимся
    type MaplibreWithProtocol = {
      addProtocol?: (
        name: string,
        handler: (
          request: RequestParameters,
          callback: ResponseCallback<ArrayBuffer | null>,
        ) => { cancel?: () => void } | void,
      ) => void;
    };
    const candidate = maplibregl as MaplibreWithProtocol;
    const handler = (
      request: RequestParameters,
      callback: ResponseCallback<ArrayBuffer | null>,
    ) => protocol.tile(request, callback);
    if (typeof candidate.addProtocol === 'function') {
      candidate.addProtocol('pmtiles', handler);
      pmtilesProtocolRegistered = true;
      console.info('Протокол pmtiles зарегистрирован успешно');
      return true;
    } else {
      console.warn(
        'Метод maplibregl.addProtocol недоступен, протокол PMTiles не будет зарегистрирован.',
      );
      return false;
    }
  } catch (error) {
    console.error(
      'Не удалось зарегистрировать протокол PMTiles (динамический импорт)',
      error,
    );
    return false;
  }
};

// Запускаем регистрацию в браузере (fire-and-forget)
if (typeof window !== 'undefined') {
  void registerPmtilesProtocol();
}

/* ---------- Fallback handling for map styles ---------- */

type MapStyleError = {
  status?: number;
  url?: string;
  message?: string;
};

type MapErrorEvent = {
  error?: MapStyleError | null;
};

type MapStyleImageMissingEvent = {
  id?: string;
};

type MapStyleFallbackOptions = {
  initialStyle?: MapOptions['style'];
  fallbackUrl?: MapOptions['style'];
  vectorFallbackUrl?: MapOptions['style'];
  logger?: Pick<typeof console, 'warn'>;
};

const RASTER_FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'osm-raster': {
      type: 'raster',
      tiles: [MAP_RASTER_STYLE_URL],
      tileSize: 256,
      attribution: MAP_ATTRIBUTION,
    },
  },
  layers: [
    {
      id: 'osm-raster',
      type: 'raster',
      source: 'osm-raster',
    },
  ],
};

const noopDetach = () => {};

/**
 * attachMapStyleFallback
 * Подписывается на события ошибки стиля и styleimagemissing, применяет fallback-стиль
 * если кастомный стиль не удаётся загрузить или в нём отсутствуют изображения.
 *
 * usage:
 * const detach = attachMapStyleFallback(map, { initialStyle: customUrl, fallbackUrl: MAP_STYLE_DEFAULT_URL });
 * detach(); // отключить подписки
 */
export const attachMapStyleFallback = (
  map: MapInstance | null,
  options: MapStyleFallbackOptions = {},
): (() => void) => {
  if (!map) {
    return noopDetach;
  }
  const initialStyle = options.initialStyle;
  const initialStyleAsString =
    typeof initialStyle === 'string' ? initialStyle : '';
  const fallbackStyle =
    typeof options.fallbackUrl === 'string'
      ? options.fallbackUrl.trim() || undefined
      : (options.fallbackUrl ?? RASTER_FALLBACK_STYLE);
  const vectorFallbackStyle =
    typeof options.vectorFallbackUrl === 'string'
      ? options.vectorFallbackUrl.trim() || undefined
      : (options.vectorFallbackUrl ?? MAP_STYLE_DEFAULT_URL);
  const fallbackCandidates: MapOptions['style'][] = [];
  const seenStringCandidates = new Set<string>();
  const pushFallbackCandidate = (candidate?: MapOptions['style']) => {
    if (!candidate) {
      return;
    }
    if (typeof candidate === 'string') {
      if (
        candidate === initialStyleAsString ||
        seenStringCandidates.has(candidate)
      ) {
        return;
      }
      seenStringCandidates.add(candidate);
    }
    fallbackCandidates.push(candidate);
  };
  pushFallbackCandidate(vectorFallbackStyle);
  pushFallbackCandidate(fallbackStyle);
  if (!initialStyle || fallbackCandidates.length === 0) {
    return noopDetach;
  }
  const logger = options.logger ?? console;
  let fallbackApplied = false;
  let styleLoaded = map.isStyleLoaded();

  let fallbackIndex = 0;
  const applyFallback = (details?: unknown) => {
    if (fallbackApplied) {
      return;
    }
    while (fallbackIndex < fallbackCandidates.length) {
      const selectedFallback = fallbackCandidates[fallbackIndex];
      fallbackIndex += 1;
      if (!selectedFallback) {
        continue;
      }
      logger.warn(
        'Не удалось загрузить кастомный стиль карты, используем резервный.',
        {
          details,
          initialStyle,
          fallbackUrl: selectedFallback,
        },
      );
      try {
        // force full replacement без diff — чтобы избежать проблем с несовместимыми стилями
        map.setStyle(selectedFallback, { diff: false });
        fallbackApplied = true;
        return;
      } catch (setStyleError) {
        console.error(
          'Не удалось применить резервный стиль карты',
          setStyleError,
        );
      }
    }
  };

  const handleError = (event: MapErrorEvent) => {
    if (fallbackApplied) {
      return;
    }
    const error = event?.error;
    if (!error) {
      applyFallback();
      return;
    }
    const url = typeof error.url === 'string' ? error.url : '';
    if (url && initialStyleAsString && url !== initialStyleAsString) {
      // если ошибка от другого URL — игнорируем
      return;
    }
    const status = typeof error.status === 'number' ? error.status : undefined;
    const message = typeof error.message === 'string' ? error.message : '';
    logger.warn('Ошибка загрузки стиля карты', {
      url,
      status,
      message,
      initialStyle,
    });
    const isStyleFailure =
      (message && message.toLowerCase().includes('style')) ||
      !url ||
      url === initialStyleAsString ||
      (typeof status === 'number' && status >= 400);
    if (!isStyleFailure) {
      return;
    }
    applyFallback(error);
  };

  const handleMissingImage = (event: MapStyleImageMissingEvent) => {
    if (fallbackApplied) {
      return;
    }
    if (styleLoaded || map.isStyleLoaded()) {
      return;
    }
    applyFallback(event);
  };

  const handleStyleData: Listener = () => {
    if (map.isStyleLoaded()) {
      styleLoaded = true;
    }
  };

  map.on('styledata', handleStyleData);

  map.on('error', handleError);
  map.on('styleimagemissing', handleMissingImage as unknown as Listener);
  return () => {
    map.off('error', handleError);
    map.off('styleimagemissing', handleMissingImage as unknown as Listener);
    map.off('styledata', handleStyleData);
  };
};

/* ---------- exports ---------- */

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
