#!/usr/bin/env node
// patch: 047-mobile-logistics.cjs
// purpose: адаптация страницы логистики под мобильные устройства и стабилизация ресайза карты
const fs = require('fs');
const path = require('path');

const filePath = path.resolve('apps/web/src/pages/Logistics.tsx');

const applyReplacement = (source, from, to) => {
  if (!source.includes(from)) {
    throw new Error('Не удалось найти фрагмент для замены');
  }
  return source.replace(from, to);
};

const run = () => {
  const original = fs.readFileSync(filePath, 'utf8');
  let next = original;

  next = applyReplacement(
    next,
    `  const [planLoading, setPlanLoading] = React.useState(false);\n  const mapRef = React.useRef<MapInstance | null>(null);\n  const drawRef = React.useRef<MapLibreDraw | null>(null);\n  React.useEffect(() => {`,
    `  const [planLoading, setPlanLoading] = React.useState(false);\n  const mapRef = React.useRef<MapInstance | null>(null);\n  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);\n  const drawRef = React.useRef<MapLibreDraw | null>(null);\n  React.useEffect(() => {`,
  );

  next = applyReplacement(
    next,
    `    const initMap = async () => {\n      if (MAP_STYLE_MODE === 'pmtiles') {\n        await registerPmtilesProtocol();\n      }\n      if (cancelled || mapRef.current) {\n        return;\n      }\n      const mapInstance = new mapLibrary.Map({\n        container: 'logistics-map',\n        style: MAP_STYLE,\n        center: MAP_CENTER_LNG_LAT,\n        zoom: MAP_DEFAULT_ZOOM,\n        minZoom: 5,\n        maxZoom: 22,\n        maxBounds: UKRAINE_BOUNDS,\n      });`,
    `    const initMap = async () => {\n      if (MAP_STYLE_MODE === 'pmtiles') {\n        await registerPmtilesProtocol();\n      }\n      if (cancelled || mapRef.current) {\n        return;\n      }\n      const container = mapContainerRef.current;\n      if (!container) {\n        return;\n      }\n      const mapInstance = new mapLibrary.Map({\n        container,\n        style: MAP_STYLE,\n        center: MAP_CENTER_LNG_LAT,\n        zoom: MAP_DEFAULT_ZOOM,\n        minZoom: 5,\n        maxZoom: 22,\n        maxBounds: UKRAINE_BOUNDS,\n      });`,
  );

  next = applyReplacement(
    next,
    `  React.useEffect(() => {\n    if (hasDialog) return;\n    if (!mapReady) return;\n    const map = mapRef.current;\n    if (!map) return;\n    if (typeof map.resize === 'function') {\n      map.resize();\n    }\n  }, [hasDialog, mapReady]);`,
    `  React.useEffect(() => {\n    if (hasDialog) return;\n    if (!mapReady) return;\n    const map = mapRef.current;\n    const container = mapContainerRef.current;\n    if (!map) return;\n    if (typeof map.resize === 'function') {\n      map.resize();\n    }\n    if (!container || typeof ResizeObserver === 'undefined') {\n      return;\n    }\n    let frameId: number | null = null;\n    const observer = new ResizeObserver((entries) => {\n      const entry = entries[0];\n      if (!entry || typeof map.resize !== 'function') {\n        return;\n      }\n      const { width, height } = entry.contentRect;\n      if (width <= 0 || height <= 0) {\n        return;\n      }\n      if (frameId !== null) {\n        cancelAnimationFrame(frameId);\n      }\n      frameId = requestAnimationFrame(() => {\n        map.resize();\n      });\n    });\n    observer.observe(container);\n    return () => {\n      observer.disconnect();\n      if (frameId !== null) {\n        cancelAnimationFrame(frameId);\n      }\n    };\n  }, [hasDialog, mapReady]);`,
  );

  next = applyReplacement(
    next,
    `<header className="flex flex-wrap items-start justify-between gap-3">`,
    `<header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">`,
  );

  next = applyReplacement(
    next,
    `            <div className="flex flex-wrap items-start justify-between gap-3">`,
    `            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">`,
  );

  next = applyReplacement(
    next,
    `            <div\n              id="logistics-map"\n              className={\`min-h-[420px] w-full rounded-lg border border-slate-200 bg-slate-50 \${hasDialog ? 'hidden' : ''}\`}\n            />`,
    `            <div\n              ref={mapContainerRef}\n              id="logistics-map"\n              className={\`block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner \${hasDialog ? 'hidden' : ''} min-h-[320px] md:min-h-[420px] lg:min-h-[520px] h-[58vh]\`}\n            />`,
  );

  next = applyReplacement(
    next,
    `                <div className="flex flex-wrap items-center gap-4">`,
    `                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">`,
  );

  next = applyReplacement(
    next,
    `                <div className="flex flex-wrap items-center justify-between gap-3">\n                  <div className="flex flex-wrap items-center gap-3">`,
    `                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">\n                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">`,
  );

  next = applyReplacement(
    next,
    `                  <div className="flex flex-wrap items-center gap-2">`,
    `                  <div className="flex flex-wrap justify-end gap-2 sm:justify-start">`,
  );

  if (next === original) {
    throw new Error('Изменения не были применены');
  }

  fs.writeFileSync(filePath, next);
};

run();
