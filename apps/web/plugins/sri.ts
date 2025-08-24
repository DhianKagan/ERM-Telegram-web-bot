/* Назначение файла: плагин Vite для расчёта SRI только для локальных ресурсов. */
import type { Plugin } from "vite";
import { load } from "cheerio";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { createHash } from "crypto";

export default function sri(): Plugin {
  return {
    name: "sri-local",
    apply: "build",
    enforce: "post",
    writeBundle(options, bundle) {
      Object.values(bundle)
        .filter((item) => item.type === "asset" && item.fileName.endsWith(".html"))
        .forEach((htmlAsset) => {
          const $ = load((htmlAsset as any).source as string);
          $("script[src],link[href]").each((_, el) => {
            const attr = el.attribs.src ? "src" : "href";
            const url = el.attribs[attr];
            if (/^https?:\/\//.test(url)) return;
            const file = resolve(options.dir!, url.replace(/^\//, ""));
            let source: Buffer;
            try {
              source = readFileSync(file);
            } catch {
              return;
            }
            const hash = createHash("sha384").update(source).digest("base64");
            el.attribs.integrity = `sha384-${hash}`;
            if (!el.attribs.crossorigin) el.attribs.crossorigin = "anonymous";
          });
          writeFileSync(resolve(options.dir!, (htmlAsset as any).fileName), $.html());
        });
    },
  };
}
