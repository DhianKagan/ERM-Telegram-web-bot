#!/usr/bin/env node
// patch: 049-logistics-map-height.cjs
// purpose: ограничить высоту карты логистики на больших экранах и сохранить адаптивность
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
    "              className={`block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner ${hasDialog ? 'hidden' : ''} min-h-[320px] md:min-h-[420px] lg:min-h-[520px] h-[58vh]`}",
    "              className={`block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner ${hasDialog ? 'hidden' : ''} min-h-[320px] md:min-h-[420px] lg:min-h-[520px] h-[58vh] max-h-[820px]`}",
  );

  fs.writeFileSync(filePath, next);
};

run();
