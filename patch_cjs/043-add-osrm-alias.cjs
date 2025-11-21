#!/usr/bin/env node
// patch: 043-add-osrm-alias.cjs
// purpose: добавить алиас /api/v1/osrm к маршрутам ОСРМ в API
const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('apps/api/src/api/routes.ts');
let source = fs.readFileSync(targetPath, 'utf8');

const needle =
  "  app.use(`${prefix}/route`, routeRouter);\n  app.use(`${prefix}/optimizer`, optimizerRouter);";
const replacement =
  "  app.use(`${prefix}/route`, routeRouter);\n  app.use(`${prefix}/osrm`, routeRouter);\n  app.use(`${prefix}/optimizer`, optimizerRouter);";

if (!source.includes(needle)) {
  throw new Error('routes snippet not found');
}

source = source.replace(needle, replacement);
fs.writeFileSync(targetPath, source, 'utf8');
console.log('updated ' + path.relative(process.cwd(), targetPath));
