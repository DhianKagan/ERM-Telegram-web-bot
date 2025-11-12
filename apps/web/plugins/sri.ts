/* Назначение файла: плагин Vite для расчёта SRI только для локальных ресурсов. */
import type { Plugin } from 'vite';
import { load } from 'cheerio';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';
import type { Buffer } from 'node:buffer';
import { cwd } from 'node:process';
import type { OutputAsset, OutputBundle } from 'rollup';

export default function sri(): Plugin {
  return {
    name: 'sri-local',
    apply: 'build',
    enforce: 'post',
    writeBundle(options, bundle) {
      Object.values(bundle as OutputBundle)
        .filter(
          (item): item is OutputAsset =>
            item.type === 'asset' && item.fileName.endsWith('.html'),
        )
        .forEach((htmlAsset) => {
          const sourceContent =
            typeof htmlAsset.source === 'string'
              ? htmlAsset.source
              : (htmlAsset.source?.toString() ?? '');
          const $ = load(sourceContent);
          $('script[src],link[href]').each((_, el) => {
            const attr = el.attribs.src ? 'src' : 'href';
            const url = el.attribs[attr];
            if (/^https?:\/\//.test(url)) return;
            const file = resolve(options.dir!, url.replace(/^\//, ''));
            let source: Buffer;
            try {
              source = readFileSync(file);
            } catch {
              return;
            }
            const hash = createHash('sha384').update(source).digest('base64');
            el.attribs.integrity = `sha384-${hash}`;
            if (!el.attribs.crossorigin) el.attribs.crossorigin = 'anonymous';
          });
          const outputDir = options.dir ?? cwd();
          writeFileSync(resolve(outputDir, htmlAsset.fileName), $.html());
        });
    },
  };
}
