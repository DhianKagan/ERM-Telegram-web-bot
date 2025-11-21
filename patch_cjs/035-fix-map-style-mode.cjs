#!/usr/bin/env node
// patch: 035-fix-map-style-mode.cjs
// purpose: корректно определять режим стиля карты по умолчанию и учитывать runtime-настройки
const fs = require('fs');
const path = require('path');

const patches = [
  {
    file: path.resolve('apps/web/src/config/map.ts'),
    from: `  if (typeof processValue === 'string' && processValue.trim() !== '') {
    return { url: processValue, source: 'env' };
  }
`,
    to: `  if (typeof processValue === 'string' && processValue.trim() !== '') {
    return { url: processValue.trim(), source: 'env' };
  }
`,
  },
  {
    file: path.resolve('apps/web/src/config/map.ts'),
    from: `// URL стиля — можно переопределить через VITE_MAP_STYLE_URL
const mapStyle = readMapStyle();
export const MAP_STYLE_URL = mapStyle.url;
const runtimeMode = readRuntimeMapStyleMode();
const isCustomStyle = mapStyle.source === 'env';

// Совместимость с существующими импортами:
export const MAP_STYLE = MAP_STYLE_URL; // ранее могли импортировать как MAP_STYLE
export const MAP_STYLE_DEFAULT_URL = DEFAULT_MAP_STYLE_URL;
export const MAP_STYLE_MODE: MapStyleMode = isCustomStyle
  ? runtimeMode ?? 'pmtiles'
  : 'raster';
export const MAP_STYLE_IS_DEFAULT = mapStyle.source === 'default';
`,
    to: `// URL стиля — можно переопределить через VITE_MAP_STYLE_URL
const mapStyle = readMapStyle();
export const MAP_STYLE_URL = mapStyle.url;
const runtimeMode = readRuntimeMapStyleMode();
const isCustomStyle = mapStyle.source === 'env';

const autoModeFromUrl = (url: string): MapStyleMode =>
  url.includes('tile.openstreetmap.org') ? 'raster' : 'pmtiles';

// Совместимость с существующими импортами:
export const MAP_STYLE = MAP_STYLE_URL; // ранее могли импортировать как MAP_STYLE
export const MAP_STYLE_DEFAULT_URL = DEFAULT_MAP_STYLE_URL;
export const MAP_STYLE_MODE: MapStyleMode = (() => {
  if (runtimeMode) return runtimeMode;
  if (isCustomStyle) return 'pmtiles';
  return autoModeFromUrl(MAP_STYLE_URL);
})();
export const MAP_STYLE_IS_DEFAULT = mapStyle.source === 'default';
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
