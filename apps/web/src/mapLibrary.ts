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
  type Map as MapInstance,
  type MapLayerMouseEvent,
  type MapMouseEvent,
  type Marker as MapMarker,
  type ExpressionSpecification,
  type MapOptions,
} from 'maplibre-gl';

import { MAP_STYLE_DEFAULT_URL } from '../config/map';

// Не импортируем pmtiles статически: const { Protocol } from 'pmtiles'; <- это ломает билд в некоторых средах.

// Загружаем CSS только в браузере (динамический импорт, чтобы сборщик не подхватывал css во время node/ssr)
if (typeof document !== 'undefined') {
  // Попробуем динамически импортировать css (Vite поддерживает), и при ошибке — fallback с <link>
  void import('maplibre-gl/dist/maplibre-gl.css').catch(() => {
    try {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      // В большинстве случаев это будет работать; это fallback если динамический импорт css не сработал.
      link.href = new URL('maplibre-gl/dist/maplibre-gl.css', location.href).href;
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
const registerPmtilesProtocol = async (): Promise<void> => {
  if (pmtilesProtocolRegistered) return;
  if (typeof window === 'undefined') return; // только в браузере

  try {
    // Динамически загружаем пакет pmtiles
    const mod = await import('pmtiles');

    // Поддерживаем разные варианты экспорта (named/default)
    // pmtiles v3 обычно экспортирует { Protocol }
    const ProtocolCandidate =
      (mod as any).Protocol ?? (mod as any).default?.Protocol ?? (mod as any).default ?? mod;

    // Найдём конструктора Protocol
    const ProtocolCtor =
      typeof ProtocolCandidate === 'function'
        ? ProtocolCandidate
        : ProtocolCandidate?.Protocol ?? null;

    if (typeof ProtocolCtor !== 'function') {
      console.error('pmtiles Protocol constructor not found in dynamic import', mod);
      return;
    }

    const protocol = new ProtocolCtor();

    // maplibregl может не иметь addProtocol в некоторых сборках — защитимся
    if (typeof (maplibregl as any).addProtocol === 'function') {
      (maplibregl as any).addProtocol('pmtiles', (request: any) => protocol.tile(request));
      pmtilesProtocolRegistered = true;
    } else {
      console.warn('maplibregl.addProtocol is not available; pmtiles protocol not registered');
    }
  } catch (error) {
    console.error('Не удалось зарегистрировать протокол PMTiles (динамический импорт)', error);
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
  fallbackUrl?: string;
  logger?: Pick<typeof console, 'warn'>;
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
  const initialStyle = typeof options.initialStyle === 'string' ? options.initialStyle : '';
  const fallbackUrl =
    typeof options.fallbackUrl === 'string' ? options.fallbackUrl : MAP_STYLE_DEFAULT_URL;
  if (!initialStyle || !fallbackUrl || initialStyle === fallbackUrl) {
    return noopDetach;
  }
  const logger = options.logger ?? console;
  let fallbackApplied = false;

  const applyFallback = (details?: unknown) => {
    if (fallbackApplied) {
      return;
    }
    fallbackApplied = true;
    logger.warn('Не удалось загрузить кастомный стиль карты, используем стиль по умолчанию.', details);
    try {
      // force full replacement без diff — чтобы избежать проблем с несовместимыми стилями
      map.setStyle(fallbackUrl, { diff: false });
    } catch (setStyleError) {
      console.error('Не удалось применить стиль по умолчанию', setStyleError);
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
    if (url && initialStyle && url !== initialStyle) {
      // если ошибка от другого URL — игнорируем
      return;
    }
    const status = typeof error.status === 'number' ? error.status : undefined;
    const message = typeof error.message === 'string' ? error.message : '';
    const isStyleFailure =
      (message && message.toLowerCase().includes('style')) ||
      !url ||
      url === initialStyle ||
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
    applyFallback(event);
  };

  map.on('error', handleError);
  map.on('styleimagemissing', handleMissingImage as unknown as Listener);
  return () => {
    map.off('error', handleError);
    map.off('styleimagemissing', handleMissingImage as unknown as Listener);
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
