#!/usr/bin/env node
// patch: 039-add-logistics-router.cjs
// purpose: подключить маршруты событий логистики в API
const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('apps/api/src/api/routes.ts');
let source = fs.readFileSync(targetPath, 'utf8');

const importsNeedle =
  "import routePlansRouter from '../routes/routePlans';\nimport analyticsRouter from '../routes/analytics';";
const importsReplacement =
  "import routePlansRouter from '../routes/routePlans';\nimport logisticsRouter from '../routes/logistics';\nimport analyticsRouter from '../routes/analytics';";

if (!source.includes(importsNeedle)) {
  throw new Error('imports snippet not found');
}
source = source.replace(importsNeedle, importsReplacement);

const routesNeedle =
  '  app.use(`${prefix}/route-plans`, routePlansRouter);\n  app.use(`${prefix}/analytics`, analyticsRouter);';
const routesReplacement =
  '  app.use(`${prefix}/route-plans`, routePlansRouter);\n  app.use(`${prefix}/logistics`, logisticsRouter);\n  app.use(`${prefix}/analytics`, analyticsRouter);';

if (!source.includes(routesNeedle)) {
  throw new Error('routes snippet not found');
}
source = source.replace(routesNeedle, routesReplacement);

fs.writeFileSync(targetPath, source, 'utf8');
console.log('updated ' + path.relative(process.cwd(), targetPath));
