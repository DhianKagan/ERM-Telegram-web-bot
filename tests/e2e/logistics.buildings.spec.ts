/**
 * Назначение файла: e2e-тест визуализации 3D-слоя зданий и проверки порядка слоёв логистической карты.
 * Основные модули: express, @playwright/test.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import type { FeatureCollection, Polygon } from 'geojson';
import { BUILDINGS_LAYER_ID, insert3dBuildingsLayer } from '../../apps/web/src/utils/insert3dBuildingsLayer';

type ViewPoint = {
  name: string;
  center: [number, number];
  zoom: number;
};

type WindowState = {
  __ERM_LAYER_ORDER__?: string[];
  __ERM_LAYER_BEFORE__?: string | null;
  __ERM_MAP__?: unknown;
  __ERM_READY__?: boolean;
  __ERM_IDLE__?: number;
};

type LayerKind = 'fill-extrusion' | 'symbol' | 'unknown';

type FeatureSnapshot = {
  className: string;
  featureKey: string | null;
  textContent: string | null;
  styles: {
    left: number | null;
    top: number | null;
    width: number | null;
    height: number | null;
    transform: string | null;
  };
};

type LayerSnapshot = {
  id: string | null;
  type: LayerKind;
  zIndex: number | null;
  features: FeatureSnapshot[];
};

type MapSnapshot = {
  state: {
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
  } | null;
  layers: LayerSnapshot[];
};

declare global {
  interface Window extends WindowState {}
}

const helperSource = insert3dBuildingsLayer.toString();

const createBuildingPolygon = (
  name: string,
  [lng, lat]: [number, number],
  sizeMeters: number,
  height: number,
): FeatureCollection<Polygon>['features'][number] => {
  const delta = sizeMeters / 111320;
  const half = delta / 2;
  return {
    type: 'Feature',
    properties: {
      name,
      extrude: 'true',
      height,
      min_height: 0,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [lng - half, lat - half],
          [lng + half, lat - half],
          [lng + half, lat + half],
          [lng - half, lat + half],
          [lng - half, lat - half],
        ],
      ],
    },
  };
};

const buildingFeatures: FeatureCollection<Polygon> = {
  type: 'FeatureCollection',
  features: [
    createBuildingPolygon('Київ · Контрактова площа', [30.5234, 50.4501], 160, 120),
    createBuildingPolygon('Львів · Площа Ринок', [24.0316, 49.842], 150, 90),
    createBuildingPolygon('Одеса · Дерибасівська', [30.7233, 46.4825], 140, 110),
    createBuildingPolygon('Харків · Свободи', [36.2292, 49.9935], 130, 105),
  ],
};

const styleDefinition = {
  version: 8,
  glyphs: '/glyphs/{fontstack}/{range}.pbf',
  sources: {
    composite: {
      type: 'geojson',
      data: buildingFeatures,
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#0f172a',
      },
    },
    {
      id: 'demo-labels',
      type: 'symbol',
      source: 'composite',
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold'],
        'text-size': 16,
        'text-anchor': 'top',
      },
      paint: {
        'text-color': '#f8fafc',
        'text-halo-color': '#0f172a',
        'text-halo-width': 1.2,
      },
    },
  ],
};

const viewPoints: ViewPoint[] = [
  { name: 'kyiv-z15.png', center: [30.5234, 50.4501], zoom: 15 },
  { name: 'lviv-z16.png', center: [24.0316, 49.842], zoom: 16 },
  { name: 'odesa-z17.png', center: [30.7233, 46.4825], zoom: 17 },
  { name: 'kharkiv-z18.png', center: [36.2292, 49.9935], zoom: 18 },
];

const app = express();

app.get('/style.json', (_req, res) => {
  res.json(styleDefinition);
});

app.get('/', (_req, res) => {
  res
    .type('html')
    .send(`<!DOCTYPE html>
  <html lang="ru">
    <head>
      <meta charset="utf-8" />
      <title>3D buildings demo</title>
      <style>
        html, body {
          margin: 0;
          padding: 0;
          background: #0f172a;
          color: #f8fafc;
          font-family: 'Open Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        body {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        #map {
          width: 800px;
          height: 600px;
          position: relative;
          perspective: 1400px;
          background: radial-gradient(circle at 30% 20%, rgba(59, 130, 246, 0.22), rgba(15, 23, 42, 0.9)),
            linear-gradient(180deg, rgba(30, 41, 59, 0.92), rgba(15, 23, 42, 0.96));
          border-radius: 32px;
          box-shadow: 0 40px 80px rgba(15, 23, 42, 0.55);
          overflow: hidden;
        }
        .fake-stage {
          position: absolute;
          inset: 0;
          transform-style: preserve-3d;
          transform-origin: 50% 75%;
          transition: transform 0.45s ease;
        }
        .fake-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          transform-style: preserve-3d;
        }
        .fake-building {
          position: absolute;
          transform-origin: center bottom;
          border-radius: 20px 20px 12px 12px;
          background: linear-gradient(180deg, rgba(148, 163, 184, 0.94), rgba(71, 85, 105, 0.98));
          box-shadow: 0 28px 52px rgba(15, 23, 42, 0.48);
        }
        .fake-building::before {
          content: '';
          position: absolute;
          left: -12%;
          right: -12%;
          bottom: -10px;
          height: 18px;
          border-radius: 9999px;
          background: radial-gradient(circle, rgba(15, 23, 42, 0.45), transparent 70%);
          filter: blur(6px);
        }
        .fake-label {
          position: absolute;
          padding: 6px 14px;
          background: rgba(15, 23, 42, 0.88);
          color: #f8fafc;
          border-radius: 9999px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.01em;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.35);
          white-space: nowrap;
          pointer-events: none;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const BUILDINGS_LAYER_ID = ${JSON.stringify(BUILDINGS_LAYER_ID)};
        const insert3dBuildingsLayer = ${helperSource};
        const styleDefinition = ${JSON.stringify(styleDefinition)};
        const initialState = ${JSON.stringify({ center: viewPoints[0].center, zoom: viewPoints[0].zoom, pitch: 58, bearing: -25 })};
        const deepClone = (value) => {
          if (typeof structuredClone === 'function') {
            return structuredClone(value);
          }
          if (value === undefined) {
            return value;
          }
          return JSON.parse(JSON.stringify(value));
        };
        const DEGREE_TO_METER_LAT = 110540;
        const metersPerDegreeLng = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);
        const evaluateFilter = (feature, filter) => {
          if (!filter) return true;
          if (!Array.isArray(filter)) return true;
          const [op, ...rest] = filter;
          if (op === '==') {
            const [left, right] = rest;
            return resolveExpression(feature, left) === resolveExpression(feature, right);
          }
          if (op === 'all') {
            return rest.every((expr) => evaluateFilter(feature, expr));
          }
          if (op === '!') {
            return !evaluateFilter(feature, rest[0]);
          }
          return true;
        };
        const resolveExpression = (feature, expression) => {
          if (Array.isArray(expression)) {
            const [operator, ...args] = expression;
            if (operator === 'get') {
              const key = args[0];
              return feature && feature.properties ? feature.properties[key] : undefined;
            }
            if (operator === 'coalesce') {
              for (const arg of args) {
                const value = resolveExpression(feature, arg);
                if (value !== null && value !== undefined && value !== '') {
                  return value;
                }
              }
              return null;
            }
            if (operator === 'literal') {
              return args[0];
            }
          }
          return expression;
        };
        class FakeMap {
          constructor(options) {
            this.containerElement = typeof options.container === 'string'
              ? document.getElementById(options.container)
              : options.container;
            if (!this.containerElement) {
              throw new Error('Container element not found');
            }
            this.containerElement.innerHTML = '';
            this.containerElement.style.position = 'relative';
            this.stage = document.createElement('div');
            this.stage.className = 'fake-stage';
            this.containerElement.appendChild(this.stage);
            this.listeners = new Map();
            this.sources = deepClone(options.style && options.style.sources ? options.style.sources : {});
            this.style = {
              version: (options.style && options.style.version) || 8,
              sources: this.sources,
              layers: (options.style && Array.isArray(options.style.layers) ? options.style.layers : []).map((layer) => deepClone(layer)),
            };
            this.state = {
              center: Array.isArray(options.center) ? options.center.slice(0, 2) : [0, 0],
              zoom: typeof options.zoom === 'number' ? options.zoom : 15,
              pitch: typeof options.pitch === 'number' ? options.pitch : 0,
              bearing: typeof options.bearing === 'number' ? options.bearing : 0,
            };
            this.featureLayout = new Map();
            this.styleLoaded = false;
            this.renderHandle = null;
            this.idleHandle = null;
            this.scheduleRender();
            setTimeout(() => {
              this.styleLoaded = true;
              this.emit('load');
              this.scheduleIdle();
            }, 40);
          }
          on(event, handler) {
            if (!this.listeners.has(event)) {
              this.listeners.set(event, new Set());
            }
            this.listeners.get(event).add(handler);
          }
          off(event, handler) {
            const handlers = this.listeners.get(event);
            if (!handlers) return;
            handlers.delete(handler);
          }
          emit(event, ...args) {
            const handlers = this.listeners.get(event);
            if (!handlers) return;
            handlers.forEach((handler) => {
              try {
                handler(...args);
              } catch (error) {
                console.error('[fake-map:handler]', error);
              }
            });
          }
          addLayer(layer, beforeId) {
            if (!layer || !layer.id) {
              throw new Error('Layer definition must include id');
            }
            if (this.getLayer(layer.id)) {
              throw new Error('Layer ' + layer.id + ' already exists');
            }
            const copy = deepClone(layer);
            if (typeof beforeId === 'string') {
              const index = this.style.layers.findIndex((item) => item.id === beforeId);
              if (index >= 0) {
                this.style.layers.splice(index, 0, copy);
              } else {
                this.style.layers.push(copy);
              }
            } else {
              this.style.layers.push(copy);
            }
            this.scheduleRender();
          }
          moveLayer(id, beforeId) {
            const currentIndex = this.style.layers.findIndex((layer) => layer.id === id);
            if (currentIndex === -1) {
              return;
            }
            const [layer] = this.style.layers.splice(currentIndex, 1);
            if (typeof beforeId === 'string') {
              const targetIndex = this.style.layers.findIndex((item) => item.id === beforeId);
              if (targetIndex >= 0) {
                this.style.layers.splice(targetIndex, 0, layer);
              } else {
                this.style.layers.push(layer);
              }
            } else {
              this.style.layers.push(layer);
            }
            this.scheduleRender();
          }
          addSource(id, source) {
            this.sources[id] = deepClone(source);
            this.scheduleRender();
          }
          getStyle() {
            return deepClone({
              version: this.style.version,
              sources: this.sources,
              layers: this.style.layers,
            });
          }
          getLayer(id) {
            return this.style.layers.find((layer) => layer.id === id) || null;
          }
          isStyleLoaded() {
            return this.styleLoaded;
          }
          jumpTo(options) {
            if (options && Array.isArray(options.center)) {
              this.state.center = options.center.slice(0, 2);
            }
            if (options && typeof options.zoom === 'number') {
              this.state.zoom = options.zoom;
            }
            if (options && typeof options.pitch === 'number') {
              this.state.pitch = options.pitch;
            }
            if (options && typeof options.bearing === 'number') {
              this.state.bearing = options.bearing;
            }
            this.scheduleRender();
          }
          scheduleRender() {
            if (this.renderHandle !== null) {
              return;
            }
            const callback = () => {
              this.renderHandle = null;
              this.render();
            };
            if (typeof requestAnimationFrame === 'function') {
              this.renderHandle = requestAnimationFrame(callback);
            } else {
              this.renderHandle = setTimeout(callback, 16);
            }
          }
          scheduleIdle() {
            if (this.idleHandle) {
              clearTimeout(this.idleHandle);
            }
            this.idleHandle = setTimeout(() => {
              if (!this.styleLoaded) {
                return;
              }
              this.emit('idle');
            }, 60);
          }
          computeMetersPerPixel() {
            const base = 6;
            return base / Math.pow(2, this.state.zoom - 15);
          }
          projectCoordinate(coord, dims) {
            const [lng, lat] = coord;
            const metersLng = metersPerDegreeLng(this.state.center[1]);
            const deltaLng = (lng - this.state.center[0]) * metersLng;
            const deltaLat = (lat - this.state.center[1]) * DEGREE_TO_METER_LAT;
            const metersPerPixel = this.computeMetersPerPixel();
            return {
              x: dims.width / 2 + deltaLng / metersPerPixel,
              y: dims.height / 2 - deltaLat / metersPerPixel,
            };
          }
          getSourceFeatures(layer) {
            const sourceId = layer && layer.source;
            const source = sourceId ? this.sources[sourceId] : undefined;
            if (!source || source.type !== 'geojson') {
              return [];
            }
            const data = source.data;
            if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
              return [];
            }
            return data.features.filter((feature) => evaluateFilter(feature, layer.filter));
          }
          getFeatureKey(feature, index) {
            if (feature && feature.id !== undefined && feature.id !== null) {
              return String(feature.id);
            }
            if (feature && feature.properties && feature.properties.name) {
              return String(feature.properties.name);
            }
            return 'feature-' + index;
          }
          renderExtrusions(layerContainer, features, dims) {
            const metersPerPixel = this.computeMetersPerPixel();
            features.forEach((feature, index) => {
              if (!feature || feature.geometry?.type !== 'Polygon') {
                return;
              }
              const ring = Array.isArray(feature.geometry.coordinates) ? feature.geometry.coordinates[0] : null;
              if (!ring) {
                return;
              }
              const projected = ring.map((coord) => this.projectCoordinate(coord, dims));
              const xs = projected.map((point) => point.x);
              const ys = projected.map((point) => point.y);
              const minX = Math.min(...xs);
              const maxX = Math.max(...xs);
              const maxY = Math.max(...ys);
              const width = maxX - minX;
              const widthClamped = Math.max(36, width);
              const heightValue = Number(resolveExpression(feature, ['coalesce', ['get', 'height'], 90])) || 90;
              const baseValue = Number(resolveExpression(feature, ['coalesce', ['get', 'min_height'], 0])) || 0;
              const extrudeMeters = Math.max(0, heightValue - baseValue);
              const extrudePx = Math.min(420, Math.max(70, (extrudeMeters / metersPerPixel) * 0.7));
              const top = maxY - extrudePx;
              const centerX = minX + width / 2;
              const building = document.createElement('div');
              building.className = 'fake-building';
              const featureKey = this.getFeatureKey(feature, index);
              building.dataset.featureKey = featureKey;
              building.style.width = widthClamped + 'px';
              building.style.height = extrudePx + 'px';
              building.style.left = centerX - widthClamped / 2 + 'px';
              building.style.top = top + 'px';
              layerContainer.appendChild(building);
              this.featureLayout.set(featureKey, {
                centerX,
                top,
              });
            });
          }
          renderLabels(layerContainer, features, dims) {
            features.forEach((feature, index) => {
              const featureKey = this.getFeatureKey(feature, index);
              const layout = this.featureLayout.get(featureKey);
              let centerX;
              let top;
              if (layout) {
                centerX = layout.centerX;
                top = layout.top;
              } else if (feature.geometry?.type === 'Polygon' && Array.isArray(feature.geometry.coordinates)) {
                const ring = feature.geometry.coordinates[0];
                const projected = ring.map((coord) => this.projectCoordinate(coord, dims));
                const xs = projected.map((point) => point.x);
                const ys = projected.map((point) => point.y);
                centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
                top = Math.min(...ys);
              } else {
                return;
              }
              const label = document.createElement('div');
              label.className = 'fake-label';
              label.textContent = String(feature.properties?.name ?? '');
              label.style.left = centerX + 'px';
              label.style.top = top - 16 + 'px';
              label.style.transform = 'translate(-50%, -100%)';
              layerContainer.appendChild(label);
            });
          }
          render() {
            if (!this.containerElement) {
              return;
            }
            const width = this.containerElement.clientWidth || 800;
            const height = this.containerElement.clientHeight || 600;
            const dims = { width, height };
            const pitch = Math.max(0, Math.min(70, this.state.pitch || 0));
            const bearing = this.state.bearing || 0;
            const scale = 1 + (this.state.zoom - 15) * 0.05;
            this.stage.style.transform = 'rotateX(' + pitch + 'deg) rotateZ(' + bearing + 'deg) scale(' + scale + ')';
            this.stage.replaceChildren();
            this.featureLayout.clear();
            this.style.layers.forEach((layer, index) => {
              if (!layer || (layer.type !== 'fill-extrusion' && layer.type !== 'symbol')) {
                return;
              }
              const layerContainer = document.createElement('div');
              layerContainer.className = 'fake-layer fake-layer-' + layer.type;
              layerContainer.dataset.layerId = layer.id;
              layerContainer.style.zIndex = String(index);
              this.stage.appendChild(layerContainer);
              const features = this.getSourceFeatures(layer);
              if (!features.length) {
                return;
              }
              if (layer.type === 'fill-extrusion') {
                this.renderExtrusions(layerContainer, features, dims);
              } else {
                this.renderLabels(layerContainer, features, dims);
              }
            });
            this.scheduleIdle();
          }
        }
        const map = new FakeMap({
          container: 'map',
          style: styleDefinition,
          center: initialState.center,
          zoom: initialState.zoom,
          pitch: initialState.pitch,
          bearing: initialState.bearing,
        });
        window.__ERM_MAP__ = map;
        map.on('load', () => {
          try {
            const beforeId = insert3dBuildingsLayer(map);
            window.__ERM_LAYER_BEFORE__ = beforeId ?? null;
          } catch (error) {
            console.error('[fake-map:insert-layer]', error);
            window.__ERM_LAYER_BEFORE__ = null;
          }
          const style = map.getStyle();
          window.__ERM_LAYER_ORDER__ = Array.isArray(style?.layers) ? style.layers.map((layer) => layer.id) : [];
          window.__ERM_READY__ = true;
        });
        map.on('idle', () => {
          window.__ERM_IDLE__ = Date.now();
        });
        map.on('error', (event) => {
          console.error('[fake-map:error]', event && event.message ? event.message : event);
        });
      <\/script>
    </body>
  </html>`);
});

let server: Server;
let baseURL: string;

test.beforeAll(() => {
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseURL = `http://127.0.0.1:${port}`;
});

test.afterAll(() => {
  server.close();
});

const waitForIdle = async (page: Page, prevIdle: number | null) => {
  await page.waitForFunction(
    (last) => {
      if (typeof window.__ERM_IDLE__ !== 'number') {
        return false;
      }
      return last === null || window.__ERM_IDLE__ > last;
    },
    prevIdle,
  );
  const currentIdle = await page.evaluate(() => window.__ERM_IDLE__ ?? null);
  return typeof currentIdle === 'number' ? currentIdle : null;
};

const captureMapSnapshot = async (page: Page): Promise<MapSnapshot> => {
  return page.evaluate<MapSnapshot>(() => {
    const parsePx = (value: string | null | undefined) => {
      if (!value) {
        return null;
      }
      const numeric = Number.parseFloat(value);
      if (!Number.isFinite(numeric)) {
        return null;
      }
      return Math.round(numeric * 100) / 100;
    };
    const parseZIndex = (value: string | null | undefined) => {
      if (!value) {
        return null;
      }
      const numeric = Number.parseInt(value, 10);
      if (!Number.isFinite(numeric)) {
        return null;
      }
      return numeric;
    };
    const map: unknown = window.__ERM_MAP__;
    const state =
      map && typeof map === 'object' && 'state' in map && map.state
        ? {
            center: Array.isArray((map as any).state.center)
              ? ((map as any).state.center.slice(0, 2) as [number, number])
              : [0, 0],
            zoom: Number((map as any).state.zoom) || 0,
            pitch: Number((map as any).state.pitch) || 0,
            bearing: Number((map as any).state.bearing) || 0,
          }
        : null;
    const stage = document.querySelector('.fake-stage');
    if (!(stage instanceof HTMLElement)) {
      return { state, layers: [] };
    }
    const layers = Array.from(stage.children).map((layerNode) => {
      const element = layerNode as HTMLElement;
      const classes = Array.from(element.classList);
      let type: LayerKind = 'unknown';
      if (classes.includes('fake-layer-fill-extrusion')) {
        type = 'fill-extrusion';
      } else if (classes.includes('fake-layer-symbol')) {
        type = 'symbol';
      }
      const features = Array.from(element.children).map((child) => {
        const node = child as HTMLElement;
        return {
          className: node.className,
          featureKey: node.dataset.featureKey ?? null,
          textContent: node.textContent ? node.textContent.trim() || null : null,
          styles: {
            left: parsePx(node.style.left),
            top: parsePx(node.style.top),
            width: parsePx(node.style.width),
            height: parsePx(node.style.height),
            transform: node.style.transform || null,
          },
        } satisfies FeatureSnapshot;
      });
      return {
        id: element.dataset.layerId ?? null,
        type,
        zIndex: parseZIndex(element.style.zIndex),
        features,
      } satisfies LayerSnapshot;
    });
    return { state, layers } satisfies MapSnapshot;
  });
};

test.describe('3D слой зданий', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Детерминированный стенд доступен только в Chromium на CI');

  test('слой добавляется перед подписями и визуально отображается', async ({ page }) => {
    const browserMessages: string[] = [];
    page.on('console', (msg) => {
      const entry = `[console:${msg.type()}] ${msg.text()}`;
      browserMessages.push(entry);
      // eslint-disable-next-line no-console
      console.log(entry);
    });
    page.on('pageerror', (error) => {
      const entry = `[pageerror] ${error.message}`;
      browserMessages.push(entry);
      // eslint-disable-next-line no-console
      console.log(entry);
    });

    await page.goto(`${baseURL}/`);
    await page.waitForFunction(() => window.__ERM_READY__ === true);

    const layerOrder = await page.evaluate(() => window.__ERM_LAYER_ORDER__ ?? []);
    const beforeId = await page.evaluate(() => window.__ERM_LAYER_BEFORE__ ?? null);

    expect(layerOrder).toContain(BUILDINGS_LAYER_ID);
    expect(beforeId).not.toBeNull();

    const layerIndex = layerOrder.indexOf(BUILDINGS_LAYER_ID);
    const labelIndex = beforeId ? layerOrder.indexOf(beforeId) : -1;
    expect(layerIndex).toBeGreaterThan(-1);
    expect(labelIndex).toBeGreaterThan(-1);
    expect(layerIndex).toBeLessThan(labelIndex);

    let lastIdle: number | null = await waitForIdle(page, null);

    for (const view of viewPoints) {
      await page.evaluate(({ center, zoom }) => {
        const map = window.__ERM_MAP__;
        if (map && typeof map.jumpTo === 'function') {
          map.jumpTo({ center, zoom, pitch: 58, bearing: -25 });
        }
      }, view);
      lastIdle = await waitForIdle(page, lastIdle);
      const layoutSnapshot = await captureMapSnapshot(page);
      const snapshotName = view.name.replace('.png', '.json');
      await expect(JSON.stringify(layoutSnapshot, null, 2)).toMatchSnapshot(snapshotName);
    }

    expect(browserMessages).not.toContain(expect.stringContaining('[pageerror]'));
  });
});
