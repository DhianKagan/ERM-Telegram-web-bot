// Назначение файла: общие настройки карт для веб-клиента на базе MapLibre
// Основные модули: maplibre-gl

import type { StyleSpecification } from "maplibre-gl";

declare const __ERM_MAP_STYLE_MODE__: string | undefined;

type MapStyleMode = "pmtiles" | "raster";

type EnvLookup = (key: string) => string | undefined;

const fromProcess: EnvLookup = (key) => {
  if (typeof process === "undefined" || !process.env) {
    return undefined;
  }
  const raw = process.env[key];
  return raw && raw.trim() ? raw.trim() : undefined;
};

const fromDefine: EnvLookup = (_key) => {
  if (typeof __ERM_MAP_STYLE_MODE__ === "string") {
    return __ERM_MAP_STYLE_MODE__;
  }
  return undefined;
};

const sanitizeStyleMode = (value: string | undefined): MapStyleMode | undefined => {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (["pmtiles", "vector", "tiles"].includes(normalized)) {
    return "pmtiles";
  }
  if (["raster", "osm", "fallback"].includes(normalized)) {
    return "raster";
  }
  return undefined;
};

const resolveStyleMode = (): MapStyleMode => {
  const explicit =
    sanitizeStyleMode(fromProcess("VITE_MAP_STYLE_MODE")) ??
    sanitizeStyleMode(fromDefine("VITE_MAP_STYLE_MODE"));
  if (explicit) {
    return explicit;
  }
  const envHint = fromProcess("VITE_USE_PMTILES");
  if (envHint && envHint.trim()) {
    return envHint === "0" || envHint.toLowerCase() === "false"
      ? "raster"
      : "pmtiles";
  }
  const nodeEnv = fromProcess("NODE_ENV");
  const isProduction = nodeEnv === "production" || nodeEnv === "production-build";
  return isProduction ? "pmtiles" : "raster";
};

const LOCAL_GLYPHS_TEMPLATE = "/tiles/fonts/{fontstack}/{range}.pbf";
const REMOTE_GLYPHS_TEMPLATE =
  "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";

const sanitizeGlyphTemplate = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed.includes("{fontstack}") || !trimmed.includes("{range}")) {
    return undefined;
  }
  return trimmed;
};

const resolveGlyphsTemplate = (styleMode: MapStyleMode): string => {
  const envTemplate =
    sanitizeGlyphTemplate(fromProcess("VITE_MAP_GLYPHS_URL")) ??
    sanitizeGlyphTemplate(fromProcess("VITE_MAP_GLYPHS_PATH"));
  if (envTemplate) {
    return envTemplate;
  }
  if (styleMode === "pmtiles") {
    return REMOTE_GLYPHS_TEMPLATE;
  }
  return LOCAL_GLYPHS_TEMPLATE;
};

export const MAP_STYLE_MODE: MapStyleMode = resolveStyleMode();

export const MAP_ATTRIBUTION = "© OpenStreetMap contributors, ODbL";
export const MAP_VECTOR_SOURCE_ID = "openmaptiles";
export const MAP_ADDRESSES_SOURCE_ID = "addresses";
export const MAP_BASEMAP_PMTILES_URL = "pmtiles://tiles/basemap.pmtiles";
export const MAP_ADDRESSES_PMTILES_URL = "pmtiles://tiles/addresses.pmtiles";
export const MAP_GLYPHS_PATH = resolveGlyphsTemplate(MAP_STYLE_MODE);

const DEV_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osmRaster: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: MAP_ATTRIBUTION,
    },
  },
  layers: [
    {
      id: "osm-raster",
      type: "raster",
      source: "osmRaster",
    },
  ],
};

const labelFont = ["Noto Sans Regular", "Open Sans Regular", "Arial Unicode MS Regular"];
const labelHalo = {
  "text-color": "#1f2937",
  "text-halo-color": "#f8fafc",
  "text-halo-width": 1.2,
};

const createPmtilesStyle = (): StyleSpecification => ({
  version: 8,
  glyphs: MAP_GLYPHS_PATH,
  sources: {
    [MAP_VECTOR_SOURCE_ID]: {
      type: "vector",
      url: MAP_BASEMAP_PMTILES_URL,
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#f8fafc",
      },
    },
    {
      id: "water-fill",
      type: "fill",
      source: MAP_VECTOR_SOURCE_ID,
      "source-layer": "water",
      paint: {
        "fill-color": "#bfdbfe",
      },
    },
    {
      id: "landcover",
      type: "fill",
      source: MAP_VECTOR_SOURCE_ID,
      "source-layer": "landcover",
      paint: {
        "fill-color": "#e2e8f0",
        "fill-opacity": 0.4,
      },
    },
    {
      id: "landuse",
      type: "fill",
      source: MAP_VECTOR_SOURCE_ID,
      "source-layer": "landuse",
      paint: {
        "fill-color": "#f1f5f9",
        "fill-opacity": 0.35,
      },
    },
    {
      id: "building",
      type: "fill",
      source: MAP_VECTOR_SOURCE_ID,
      "source-layer": "building",
      paint: {
        "fill-color": "#cbd5f5",
        "fill-outline-color": "#94a3b8",
      },
    },
    {
      id: "road",
      type: "line",
      source: MAP_VECTOR_SOURCE_ID,
      "source-layer": "transportation",
      paint: {
        "line-color": "#94a3b8",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          0.2,
          12,
          1.2,
          16,
          2.6,
        ],
      },
    },
    {
      id: "road-major",
      type: "line",
      source: MAP_VECTOR_SOURCE_ID,
      "source-layer": "transportation",
      filter: ["==", ["get", "class"], "trunk"],
      paint: {
        "line-color": "#64748b",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          6,
          0.6,
          12,
          2.4,
          16,
          4,
        ],
      },
    },
    {
      id: "street-label",
      type: "symbol",
      source: MAP_VECTOR_SOURCE_ID,
      "source-layer": "transportation_name",
      layout: {
        "text-field": [
          "coalesce",
          ["get", "name:uk"],
          ["get", "name:ru"],
          ["get", "name"],
        ],
        "text-font": labelFont,
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13,
          10,
          18,
          15,
        ],
        "symbol-placement": "line",
      },
      paint: labelHalo,
    },
    {
      id: "settlement-major-label",
      type: "symbol",
      source: MAP_VECTOR_SOURCE_ID,
      "source-layer": "place",
      filter: [
        "any",
        ["==", ["get", "class"], "city"],
        ["==", ["get", "class"], "town"],
      ],
      layout: {
        "text-field": [
          "coalesce",
          ["get", "name:uk"],
          ["get", "name:ru"],
          ["get", "name"],
        ],
        "text-font": labelFont,
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          6,
          11,
          14,
          20,
        ],
      },
      paint: labelHalo,
    },
  ],
});

export const MAP_STYLE: StyleSpecification =
  MAP_STYLE_MODE === "pmtiles" ? createPmtilesStyle() : DEV_RASTER_STYLE;

export const MAP_DEFAULT_CENTER: [number, number] = [48.3794, 31.1656];
export const MAP_DEFAULT_ZOOM = 6;
export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [22.1372, 44.3865],
  [40.2286, 52.3796],
];

export const MAP_ANIMATION_SPEED_KMH = 45;
