/* Назначение файла: плагин Vite, добавляющий placeholder nonce для встроенных скриптов и стилей. */
import type { Plugin } from "vite";
import { load } from "cheerio";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";

const PLACEHOLDER = "__CSP_NONCE__";

export default function inlineNonce(): Plugin {
  return {
    name: "inline-nonce-placeholder",
    apply: "build",
    enforce: "post",
    writeBundle(options, bundle) {
      Object.values(bundle)
        .filter(
          (item) => item.type === "asset" && item.fileName.endsWith(".html"),
        )
        .forEach((htmlAsset) => {
          const asset = htmlAsset as { source: string };
          const source = asset.source;
          const $ = load(source);
          $("script:not([src])").each((_, el) => {
            if (!el.attribs.nonce) {
              el.attribs.nonce = PLACEHOLDER;
            }
          });
          $("style").each((_, el) => {
            if (!el.attribs.nonce) {
              el.attribs.nonce = PLACEHOLDER;
            }
          });
          const html = $.html();
          asset.source = html;
          const filePath = resolve(options.dir ?? "", htmlAsset.fileName);
          writeFileSync(filePath, html);
        });
    },
  };
}
