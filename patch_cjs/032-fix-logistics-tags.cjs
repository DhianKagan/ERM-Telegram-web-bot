#!/usr/bin/env node
// patch: 032-fix-logistics-tags.cjs
// purpose: исправить разметку карты логистики — корректные закрывающие теги section и CollapsibleCard
const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('apps/web/src/pages/Logistics.tsx');
let source = fs.readFileSync(targetPath, 'utf8');

const mapClosing = String.raw`            ) : null}
          </CollapsibleCard>
          <CollapsibleCard
            title={t('logistics.tasksHeading')}`;
const mapReplacement = String.raw`            ) : null}
          </section>
          <CollapsibleCard
            title={t('logistics.tasksHeading')}`;
if (!source.includes(mapClosing)) {
  throw new Error('map section closing snippet not found');
}
source = source.replace(mapClosing, mapReplacement);

const layersClosing = String.raw`          </section>
          <CollapsibleCard
            title={t('logistics.legendTitle')}`;
const layersReplacement = String.raw`          </CollapsibleCard>
          <CollapsibleCard
            title={t('logistics.legendTitle')}`;
if (!source.includes(layersClosing)) {
  throw new Error('layers closing snippet not found');
}
source = source.replace(layersClosing, layersReplacement);

fs.writeFileSync(targetPath, source, 'utf8');
console.log('updated ' + path.relative(process.cwd(), targetPath));
