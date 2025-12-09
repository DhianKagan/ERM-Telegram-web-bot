// apps/web/src/lib/mapLibrary.ts
import maplibregl, { Map, MapboxOptions, Style } from 'maplibre-gl';

type MaybeString = string | undefined | null;

const STYLE_URL = (import.meta.env.VITE_MAP_STYLE_URL as MaybeString) ?? '/tiles/maplibre-style.json';
const USE_PMTILES = (import.meta.env.VITE_USE_PMTILES as string | undefined) === '1';
const PMTILES_URL = import.meta.env.VITE_MAP_ADDRESSES_PMTILES_URL as MaybeString;

function logInfo(...args: unknown[]) { console.info('[map]', ...args); }
function logWarn(...args: unknown[]) { console.warn('[map]', ...args); }
function logError(...args: unknown[]) { console.error('[map]', ...args); }

function createAndAddPlaceholderImage(map: Map, id = 'placeholder-icon', size = 24, color = '#333') {
  if (map.hasImage(id)) return id;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return id;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  map.addImage(id, canvas);
  return id;
}

function isRasterStyle(style: Style | any) {
  try {
    if (style.sources) {
      for (const key of Object.keys(style.sources)) {
        const s = style.sources[key];
        if (!s) continue;
        const t = String(s.type ?? '').toLowerCase();
        if (t === 'vector' || t === 'geojson') {
          return false;
        }
      }
    }
    if (Array.isArray(style.layers)) {
      for (const layer of style.layers) {
        if (layer.type && layer.type !== 'raster' && layer.type !== 'background') {
          return false;
        }
      }
    }
    const hasSprite = typeof style.sprite === 'string' && style.sprite.length > 0;
    const hasGlyphs = typeof style.glyphs === 'string' && style.glyphs.length > 0;
    if (hasSprite || hasGlyphs) return false;
    return true;
  } catch (e) {
    return false;
  }
}

async function fetchStyleJson(url: string, timeoutMs = 10000): Promise<Style | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!resp.ok) {
      logWarn('Style fetch returned not ok', resp.status, resp.statusText);
      return null;
    }
    const json = await resp.json();
    return json as Style;
  } catch (e) {
    clearTimeout(id);
    logWarn('Style fetch failed', e);
    return null;
  }
}

export async function createMap(container: string | HTMLElement, opts?: {
  center?: [number, number];
  zoom?: number;
}): Promise<Map> {
  const center = opts?.center ?? [30.66, 46.34];
  const zoom = typeof opts?.zoom === 'number' ? opts.zoom : 10;

  logInfo('Loading map style from', STYLE_URL);
  let style = await fetchStyleJson(STYLE_URL);

  if (!style || !isRasterStyle(style)) {
    if (!style) {
      logWarn('Style could not be fetched, using fallback raster style');
    } else {
      logWarn('Provided style looks vector or contains sprite/glyphs — forcing raster fallback');
    }
    style = {
      version: 8,
      name: 'ERM Raster fallback',
      sources: {
        'raster-tiles': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors'
        }
      },
      layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#eaeaea' } },
        { id: 'osm-raster', type: 'raster', source: 'raster-tiles', minzoom: 0, maxzoom: 19, paint: { 'raster-opacity': 1 } }
      ],
      center,
      zoom,
      bearing: 0,
      pitch: 0
    } as Style;
  }

  const mapOptions: MapboxOptions = {
    container: typeof container === 'string' ? container : (container as HTMLElement),
    style: style as any,
    center,
    zoom,
    attributionControl: false
  };

  const map = new maplibregl.Map(mapOptions);
  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

  map.on('styleimagemissing', (ev) => {
    try {
      const id = ev.id;
      if (!map.hasImage(id)) {
        createAndAddPlaceholderImage(map, String(id), 28, '#3b82f6');
      }
    } catch (e) {
    }
  });

  map.on('error', (ev) => {
    logWarn('map error event', ev?.error ?? ev);
  });

  map.on('load', async () => {
    logInfo('Map loaded, style applied');

    if (USE_PMTILES && PMTILES_URL) {
      try {
        const pmUrl = PMTILES_URL;
        logInfo('Attempting to add PMTiles source', pmUrl);
        map.addSource('addresses-pmtiles', {
          type: 'vector',
          url: pmUrl
        } as any);

        if (!map.hasImage('marker-15')) {
          createAndAddPlaceholderImage(map, 'marker-15', 20, '#ff5722');
        }

        const sourceLayer = 'addresses'; // <-- возможно нужно поправить под вашу pmtiles
        map.addLayer({
          id: 'addresses-points',
          type: 'symbol',
          source: 'addresses-pmtiles',
          'source-layer': sourceLayer,
          layout: {
            'icon-image': 'marker-15',
            'icon-size': 1,
            'text-field': ['coalesce', ['get', 'name'], ['get', 'addr']],
            'text-size': 12,
            'text-offset': [0, 1.1]
          },
          paint: { 'text-color': '#222' }
        }, undefined);
        logInfo('PMTiles addresses layer added (best-effort).');
      } catch (e) {
        logWarn('Unable to add PMTiles source/layer — pmtiles support or source-layer name may be missing.', e);
      }
    }

    const placeholderNames = ['park','parking','butcher','bakery','car','garden','cafe','pharmacy','toilets','office'];
    placeholderNames.forEach((name) => {
      if (!map.hasImage(name)) createAndAddPlaceholderImage(map, name, 18, '#666');
    });
  });

  return map;
}
