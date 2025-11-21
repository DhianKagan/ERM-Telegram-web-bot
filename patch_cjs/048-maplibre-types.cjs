#!/usr/bin/env node
// patch: 048-maplibre-types.cjs
// purpose: убрать any в mapLibrary при динамическом импорте pmtiles
const fs = require('fs');
const path = require('path');

const filePath = path.resolve('apps/web/src/mapLibrary.ts');

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
    `  try {\n    // Динамически загружаем пакет pmtiles\n    const mod = await import('pmtiles');\n\n    // Поддерживаем разные варианты экспорта (named/default)\n    // pmtiles v3 обычно экспортирует { Protocol }\n    const ProtocolCandidate =\n      (mod as any).Protocol ?? (mod as any).default?.Protocol ?? (mod as any).default ?? mod;\n\n    // Найдём конструктора Protocol\n    const ProtocolCtor =\n      typeof ProtocolCandidate === 'function'\n        ? ProtocolCandidate\n        : ProtocolCandidate?.Protocol ?? null;\n`,
    `  try {\n    // Динамически загружаем пакет pmtiles\n    type PmtilesProtocol = { tile: (request: unknown) => unknown };\n    type PmtilesModule = {\n      Protocol?: new () => PmtilesProtocol;\n      default?: new () => PmtilesProtocol | { Protocol?: new () => PmtilesProtocol };\n    };\n    const mod = (await import('pmtiles')) as PmtilesModule;\n\n    const resolveProtocolCtor = (\n      module: PmtilesModule,\n    ): (new () => PmtilesProtocol) | null => {\n      if (typeof module.Protocol === 'function') {\n        return module.Protocol;\n      }\n      const fallback = module.default;\n      if (typeof fallback === 'function') {\n        return fallback;\n      }\n      if (\n        fallback &&\n        typeof fallback === 'object' &&\n        typeof (fallback as { Protocol?: unknown }).Protocol === 'function'\n      ) {\n        return (fallback as { Protocol: new () => PmtilesProtocol }).Protocol;\n      }\n      return null;\n    };\n\n    const ProtocolCtor = resolveProtocolCtor(mod);\n`,
  );

  next = applyReplacement(
    next,
    `    // maplibregl может не иметь addProtocol в некоторых сборках — защитимся\n    if (typeof (maplibregl as any).addProtocol === 'function') {\n      (maplibregl as any).addProtocol('pmtiles', (request: any) => protocol.tile(request));\n      pmtilesProtocolRegistered = true;\n    } else {\n      console.warn('maplibregl.addProtocol is not available; pmtiles protocol not registered');\n    }\n`,
    `    // maplibregl может не иметь addProtocol в некоторых сборках — защитимся\n    type MaplibreWithProtocol = {\n      addProtocol?: (name: string, handler: (request: unknown) => unknown) => void;\n    };\n    const candidate = maplibregl as MaplibreWithProtocol;\n    if (typeof candidate.addProtocol === 'function') {\n      candidate.addProtocol('pmtiles', (request: unknown) => protocol.tile(request));\n      pmtilesProtocolRegistered = true;\n    } else {\n      console.warn('maplibregl.addProtocol is not available; pmtiles protocol not registered');\n    }\n`,
  );

  if (next === original) {
    throw new Error('Изменения не были применены');
  }

  fs.writeFileSync(filePath, next);
};

run();
