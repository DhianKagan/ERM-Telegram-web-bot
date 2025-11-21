#!/usr/bin/env node
// patch: 046-fix-logistics-layers.cjs
// purpose: ожидать регистрацию pmtiles перед инициализацией карты логистики и избегать отсутствия слоёв
const fs = require('fs');
const path = require('path');

const patches = [
  {
    file: path.resolve('apps/web/src/pages/Logistics.tsx'),
    from: `import mapLibrary, {
  type ExpressionSpecification,
  type GeoJSONSource,
  type Listener,
  type LngLatBoundsLike,
  type MapInstance,
  type MapLayerMouseEvent,
  attachMapStyleFallback,
} from '../utils/mapLibrary';
`,
    to: `import mapLibrary, {
  type ExpressionSpecification,
  type GeoJSONSource,
  type Listener,
  type LngLatBoundsLike,
  type MapInstance,
  type MapLayerMouseEvent,
  attachMapStyleFallback,
  registerPmtilesProtocol,
} from '../utils/mapLibrary';
`,
  },
  {
    file: path.resolve('apps/web/src/pages/Logistics.tsx'),
    from: `  React.useEffect(() => {
    if (hasDialog) return;
    if (mapRef.current) return;
    const map = new mapLibrary.Map({
      container: 'logistics-map',
      style: MAP_STYLE,
      center: MAP_CENTER_LNG_LAT,
      zoom: MAP_DEFAULT_ZOOM,
      minZoom: 5,
      maxZoom: 22,
      maxBounds: UKRAINE_BOUNDS,
    });
    mapRef.current = map;
    const detachStyleFallback = attachMapStyleFallback(map, {
      initialStyle: MAP_STYLE,
    });
    if (typeof map.dragRotate?.disable === 'function') {
      map.dragRotate.disable();
    }
    if (typeof map.touchZoomRotate?.disableRotation === 'function') {
      map.touchZoomRotate.disableRotation();
    }
    const navigation = new mapLibrary.NavigationControl({ showCompass: false });
    map.addControl(navigation, 'top-right');
    const attribution = new mapLibrary.AttributionControl({
      compact: true,
      customAttribution: MAP_ATTRIBUTION,
    });
    map.addControl(attribution, 'bottom-right');
    const draw = new MapLibreDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: 'simple_select',
      styles: customTheme,
    });
    drawRef.current = draw;
    map.addControl(draw, 'top-left');
    const ensureBuildingsLayer = () => {
      if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) {
        return;
      }
      insert3dBuildingsLayer(map);
    };
    const handleLoad = () => {
      ensureBuildingsLayer();
      if (
        !isRasterFallback &&
        HAS_ADDRESS_VECTOR_SOURCE &&
        !map.getSource(ADDRESS_SOURCE_ID)
      ) {
        map.addSource(ADDRESS_SOURCE_ID, {
          type: 'vector',
          url: ADDRESS_VECTOR_SOURCE_URL,
        });
        const addressLayer: SymbolLayerSpecification = {
          id: ADDRESS_LAYER_ID,
          type: 'symbol',
          source: ADDRESS_SOURCE_ID,
          'source-layer': ADDRESS_VECTOR_SOURCE_LAYER,
          minzoom: 17,
          layout: {
            'text-field': ['get', 'housenumber'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 13,
            'text-letter-spacing': 0.02,
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'text-padding': 2,
          },
          paint: {
            'text-color': '#0f172a',
            'text-halo-color': '#f8fafc',
            'text-halo-width': 1.2,
            'text-halo-blur': 0.6,
          },
        };
        const beforeLayerId = findExistingLayerId(
          map,
          MAJOR_LABEL_LAYER_CANDIDATES,
        );
        map.addLayer(addressLayer, beforeLayerId);
        ensureAddressesLayerOrder(map);
      }
      map.addSource(GEO_SOURCE_ID, {
        type: 'geojson',
        data: createEmptyCollection(),
      });
      map.addLayer({
        id: GEO_FILL_LAYER_ID,
        type: 'fill',
        source: GEO_SOURCE_ID,
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['get', 'active'], false],
            'rgba(37, 99, 235, 0.35)',
            'rgba(148, 163, 184, 0.2)',
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['get', 'active'], false],
            0.4,
            0.2,
          ],
        },
      });
      map.addLayer({
        id: GEO_OUTLINE_LAYER_ID,
        type: 'line',
        source: GEO_SOURCE_ID,
        paint: {
          'line-color': [
            'case',
            ['boolean', ['get', 'active'], false],
            '#2563eb',
            '#94a3b8',
          ],
          'line-width': [
            'case',
            ['boolean', ['get', 'active'], false],
            2.5,
            1.5,
          ],
        },
      });
      map.addSource(OPT_SOURCE_ID, {
        type: 'geojson',
        data: createEmptyCollection(),
      });
      const optimizedLayer: LineLayerSpecification = {
        id: OPT_LAYER_ID,
        type: 'line',
        source: OPT_SOURCE_ID,
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 4,
          'line-dasharray': [1.5, 1.5],
          'line-opacity': 0.8,
        },
      };
      map.addLayer(optimizedLayer);
      map.addSource(TASK_SOURCE_ID, {
        type: 'geojson',
        data: createEmptyCollection(),
      });
      const taskLineLayer: LineLayerSpecification = {
        id: TASK_LAYER_ID,
        type: 'line',
        source: TASK_SOURCE_ID,
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3,
          'line-opacity': 0.85,
        },
      };
      map.addLayer(taskLineLayer);
      map.addSource(TASK_CLUSTER_SOURCE_ID, {
        type: 'geojson',
        data: createEmptyCollection(),
        cluster: true,
        clusterRadius: 60,
        clusterMaxZoom: 14,
        clusterProperties: {
          draft: CLUSTER_STATUS_PROPERTIES.draft,
          approved: CLUSTER_STATUS_PROPERTIES.approved,
          completed: CLUSTER_STATUS_PROPERTIES.completed,
          unassigned: CLUSTER_STATUS_PROPERTIES.unassigned,
        },
      });
      const clusterLayer: CircleLayerSpecification = {
        id: TASK_CLUSTER_LAYER_ID,
        type: 'circle',
        source: TASK_CLUSTER_SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'case',
            [
              'all',
              ['>=', ['get', 'completed'], ['get', 'approved']],
              ['>=', ['get', 'completed'], ['get', 'draft']],
              ['>=', ['get', 'completed'], ['get', 'unassigned']],
            ],
            ROUTE_STATUS_COLORS.completed,
            [
              'all',
              ['>=', ['get', 'approved'], ['get', 'draft']],
              ['>=', ['get', 'approved'], ['get', 'unassigned']],
            ],
            ROUTE_STATUS_COLORS.approved,
            ['>=', ['get', 'draft'], ['get', 'unassigned']],
            ROUTE_STATUS_COLORS.draft,
            ROUTE_STATUS_COLORS.unassigned,
          ],
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8,
            16,
            12,
            22,
            14,
            30,
          ],
          'circle-opacity': 0.82,
          'circle-stroke-width': 1.6,
          'circle-stroke-color': '#f8fafc',
        },
      };
      map.addLayer(clusterLayer);
      const clusterCountLayer: SymbolLayerSpecification = {
        id: TASK_CLUSTER_COUNT_LAYER_ID,
        type: 'symbol',
        source: TASK_CLUSTER_SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.2,
        },
      };
      map.addLayer(clusterCountLayer);
      const pointsLayer: SymbolLayerSpecification = {
        id: TASK_POINTS_LAYER_ID,
        type: 'symbol',
        source: TASK_CLUSTER_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['get', 'iconId'],
          'icon-size': [
            'case',
            ['boolean', ['get', 'selected'], false],
            0.8,
            0.65,
          ],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'text-field': ['coalesce', ['get', 'label'], ''],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 10,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'icon-opacity': 0.95,
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 0.9,
        },
      };
      map.addLayer(pointsLayer);
      map.addSource(TASK_ANIMATION_SOURCE_ID, {
        type: 'geojson',
        data: createEmptyCollection(),
      });
      const animationLayer: SymbolLayerSpecification = {
        id: TASK_ANIMATION_LAYER_ID,
        type: 'symbol',
        source: TASK_ANIMATION_SOURCE_ID,
        layout: {
          'text-field': ['get', 'icon'],
          'text-size': 20,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-rotate': ['get', 'bearing'],
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': 'rgba(17, 24, 39, 0.55)',
          'text-halo-width': 1.2,
        },
      };
      map.addLayer(animationLayer);
      setMapReady(true);
    };
    map.on('styledata', ensureBuildingsLayer);
    map.on('load', handleLoad);
    return () => {
      detachStyleFallback();
      if (typeof map.off === 'function') {
        map.off('styledata', ensureBuildingsLayer);
        map.off('load', handleLoad);
      }
      setMapReady(false);
      setIsDrawing(false);
      drawRef.current = null;
      stopRouteAnimation();
      map.remove();
      mapRef.current = null;
    };
  }, [hasDialog, stopRouteAnimation]);
`,
    to: `  React.useEffect(() => {
    if (hasDialog) return;
    if (mapRef.current) return;

    let cancelled = false;
    let map: MapInstance | null = null;
    let detachStyleFallback: () => void = () => {};
    let ensureBuildingsLayer: (() => void) | null = null;
    let handleLoad: (() => void) | null = null;

    const initMap = async () => {
      if (MAP_STYLE_MODE === 'pmtiles') {
        await registerPmtilesProtocol();
      }
      if (cancelled || mapRef.current) {
        return;
      }
      const mapInstance = new mapLibrary.Map({
        container: 'logistics-map',
        style: MAP_STYLE,
        center: MAP_CENTER_LNG_LAT,
        zoom: MAP_DEFAULT_ZOOM,
        minZoom: 5,
        maxZoom: 22,
        maxBounds: UKRAINE_BOUNDS,
      });
      map = mapInstance;
      mapRef.current = mapInstance;
      detachStyleFallback = attachMapStyleFallback(mapInstance, {
        initialStyle: MAP_STYLE,
      });
      if (typeof mapInstance.dragRotate?.disable === 'function') {
        mapInstance.dragRotate.disable();
      }
      if (typeof mapInstance.touchZoomRotate?.disableRotation === 'function') {
        mapInstance.touchZoomRotate.disableRotation();
      }
      const navigation = new mapLibrary.NavigationControl({ showCompass: false });
      mapInstance.addControl(navigation, 'top-right');
      const attribution = new mapLibrary.AttributionControl({
        compact: true,
        customAttribution: MAP_ATTRIBUTION,
      });
      mapInstance.addControl(attribution, 'bottom-right');
      const draw = new MapLibreDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
        defaultMode: 'simple_select',
        styles: customTheme,
      });
      drawRef.current = draw;
      mapInstance.addControl(draw, 'top-left');
      ensureBuildingsLayer = () => {
        if (
          typeof mapInstance.isStyleLoaded === 'function' &&
          !mapInstance.isStyleLoaded()
        ) {
          return;
        }
        insert3dBuildingsLayer(mapInstance);
      };
      handleLoad = () => {
        ensureBuildingsLayer?.();
        if (
          !isRasterFallback &&
          HAS_ADDRESS_VECTOR_SOURCE &&
          !mapInstance.getSource(ADDRESS_SOURCE_ID)
        ) {
          mapInstance.addSource(ADDRESS_SOURCE_ID, {
            type: 'vector',
            url: ADDRESS_VECTOR_SOURCE_URL,
          });
          const addressLayer: SymbolLayerSpecification = {
            id: ADDRESS_LAYER_ID,
            type: 'symbol',
            source: ADDRESS_SOURCE_ID,
            'source-layer': ADDRESS_VECTOR_SOURCE_LAYER,
            minzoom: 17,
            layout: {
              'text-field': ['get', 'housenumber'],
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-size': 13,
              'text-letter-spacing': 0.02,
              'text-allow-overlap': false,
              'text-ignore-placement': false,
              'text-padding': 2,
            },
            paint: {
              'text-color': '#0f172a',
              'text-halo-color': '#f8fafc',
              'text-halo-width': 1.2,
              'text-halo-blur': 0.6,
            },
          };
          const beforeLayerId = findExistingLayerId(
            mapInstance,
            MAJOR_LABEL_LAYER_CANDIDATES,
          );
          mapInstance.addLayer(addressLayer, beforeLayerId);
          ensureAddressesLayerOrder(mapInstance);
        }
        mapInstance.addSource(GEO_SOURCE_ID, {
          type: 'geojson',
          data: createEmptyCollection(),
        });
        mapInstance.addLayer({
          id: GEO_FILL_LAYER_ID,
          type: 'fill',
          source: GEO_SOURCE_ID,
          paint: {
            'fill-color': [
              'case',
              ['boolean', ['get', 'active'], false],
              'rgba(37, 99, 235, 0.35)',
              'rgba(148, 163, 184, 0.2)',
            ],
            'fill-opacity': [
              'case',
              ['boolean', ['get', 'active'], false],
              0.4,
              0.2,
            ],
          },
        });
        mapInstance.addLayer({
          id: GEO_OUTLINE_LAYER_ID,
          type: 'line',
          source: GEO_SOURCE_ID,
          paint: {
            'line-color': [
              'case',
              ['boolean', ['get', 'active'], false],
              '#2563eb',
              '#94a3b8',
            ],
            'line-width': [
              'case',
              ['boolean', ['get', 'active'], false],
              2.5,
              1.5,
            ],
          },
        });
        mapInstance.addSource(OPT_SOURCE_ID, {
          type: 'geojson',
          data: createEmptyCollection(),
        });
        const optimizedLayer: LineLayerSpecification = {
          id: OPT_LAYER_ID,
          type: 'line',
          source: OPT_SOURCE_ID,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 4,
            'line-dasharray': [1.5, 1.5],
            'line-opacity': 0.8,
          },
        };
        mapInstance.addLayer(optimizedLayer);
        mapInstance.addSource(TASK_SOURCE_ID, {
          type: 'geojson',
          data: createEmptyCollection(),
        });
        const taskLineLayer: LineLayerSpecification = {
          id: TASK_LAYER_ID,
          type: 'line',
          source: TASK_SOURCE_ID,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 3,
            'line-opacity': 0.85,
          },
        };
        mapInstance.addLayer(taskLineLayer);
        mapInstance.addSource(TASK_CLUSTER_SOURCE_ID, {
          type: 'geojson',
          data: createEmptyCollection(),
          cluster: true,
          clusterRadius: 60,
          clusterMaxZoom: 14,
          clusterProperties: {
            draft: CLUSTER_STATUS_PROPERTIES.draft,
            approved: CLUSTER_STATUS_PROPERTIES.approved,
            completed: CLUSTER_STATUS_PROPERTIES.completed,
            unassigned: CLUSTER_STATUS_PROPERTIES.unassigned,
          },
        });
        const clusterLayer: CircleLayerSpecification = {
          id: TASK_CLUSTER_LAYER_ID,
          type: 'circle',
          source: TASK_CLUSTER_SOURCE_ID,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'case',
              [
                'all',
                ['>=', ['get', 'completed'], ['get', 'approved']],
                ['>=', ['get', 'completed'], ['get', 'draft']],
                ['>=', ['get', 'completed'], ['get', 'unassigned']],
              ],
              ROUTE_STATUS_COLORS.completed,
              [
                'all',
                ['>=', ['get', 'approved'], ['get', 'draft']],
                ['>=', ['get', 'approved'], ['get', 'unassigned']],
              ],
              ROUTE_STATUS_COLORS.approved,
              ['>=', ['get', 'draft'], ['get', 'unassigned']],
              ROUTE_STATUS_COLORS.draft,
              ROUTE_STATUS_COLORS.unassigned,
            ],
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8,
              16,
              12,
              22,
              14,
              30,
            ],
            'circle-opacity': 0.82,
            'circle-stroke-width': 1.6,
            'circle-stroke-color': '#f8fafc',
          },
        };
        mapInstance.addLayer(clusterLayer);
        const clusterCountLayer: SymbolLayerSpecification = {
          id: TASK_CLUSTER_COUNT_LAYER_ID,
          type: 'symbol',
          source: TASK_CLUSTER_SOURCE_ID,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 12,
          },
          paint: {
            'text-color': '#0f172a',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.2,
          },
        };
        mapInstance.addLayer(clusterCountLayer);
        const pointsLayer: SymbolLayerSpecification = {
          id: TASK_POINTS_LAYER_ID,
          type: 'symbol',
          source: TASK_CLUSTER_SOURCE_ID,
          filter: ['!', ['has', 'point_count']],
          layout: {
            'icon-image': ['get', 'iconId'],
            'icon-size': [
              'case',
              ['boolean', ['get', 'selected'], false],
              0.8,
              0.65,
            ],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'text-field': ['coalesce', ['get', 'label'], ''],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 10,
            'text-offset': [0, 1.4],
            'text-anchor': 'top',
            'text-optional': true,
          },
          paint: {
            'icon-opacity': 0.95,
            'text-color': '#0f172a',
            'text-halo-color': '#ffffff',
            'text-halo-width': 0.9,
          },
        };
        mapInstance.addLayer(pointsLayer);
        mapInstance.addSource(TASK_ANIMATION_SOURCE_ID, {
          type: 'geojson',
          data: createEmptyCollection(),
        });
        const animationLayer: SymbolLayerSpecification = {
          id: TASK_ANIMATION_LAYER_ID,
          type: 'symbol',
          source: TASK_ANIMATION_SOURCE_ID,
          layout: {
            'text-field': ['get', 'icon'],
            'text-size': 20,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-rotate': ['get', 'bearing'],
          },
          paint: {
            'text-color': ['get', 'color'],
            'text-halo-color': 'rgba(17, 24, 39, 0.55)',
            'text-halo-width': 1.2,
          },
        };
        mapInstance.addLayer(animationLayer);
        setMapReady(true);
      };
      mapInstance.on('styledata', ensureBuildingsLayer);
      mapInstance.on('load', handleLoad);
    };

    void initMap();

    return () => {
      cancelled = true;
      detachStyleFallback();
      if (map && typeof map.off === 'function') {
        if (ensureBuildingsLayer) {
          map.off('styledata', ensureBuildingsLayer);
        }
        if (handleLoad) {
          map.off('load', handleLoad);
        }
      }
      setMapReady(false);
      setIsDrawing(false);
      drawRef.current = null;
      stopRouteAnimation();
      if (map) {
        map.remove();
      }
      mapRef.current = null;
    };
  }, [hasDialog, stopRouteAnimation]);
`,
  },
];

for (const patch of patches) {
  const source = fs.readFileSync(patch.file, 'utf8');
  if (!source.includes(patch.from)) {
    throw new Error(`snippet not found in ${patch.file}`);
  }
  const updated = source.replace(patch.from, patch.to);
  fs.writeFileSync(patch.file, updated, 'utf8');
  console.log('updated ' + path.relative(process.cwd(), patch.file));
}
