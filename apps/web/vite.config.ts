/* eslint-env node */
/* eslint-disable no-undef */

/**
 * Назначение файла: конфигурация Vite для мини-приложения.
 * Основные модули: vite, @vitejs/plugin-react, @vitejs/plugin-legacy.
 */
import {
  defineConfig,
  loadEnv,
  splitVendorChunkPlugin,
  type IndexHtmlTransformContext,
} from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import { resolve } from "path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import sri from "./plugins/sri";
import inlineNonce from "./plugins/inlineNonce";
import { visualizer } from "rollup-plugin-visualizer";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";

/**
 * Плагин сохраняет `index.html` с уведомлением, чтобы Vite не удалял файл при
 * очистке каталога. В продакшн-сборке не восстанавливает файл, если переменная
 * `RESTORE_PLACEHOLDER` не равна `1`.
 */
function preserveIndexHtml() {
  const indexPath = resolve(__dirname, "../api/public/index.html");
  const restore = process.env.RESTORE_PLACEHOLDER === "1";
  let original = "";
  return {
    name: "preserve-index-html",
    buildStart() {
      if (restore && existsSync(indexPath)) {
        original = readFileSync(indexPath, "utf8");
      }
    },
    closeBundle() {
      if (restore && original) {
        writeFileSync(indexPath, original);
      }
    },
  };
}

function cspNonceDevPlugin() {
  const placeholder = "__CSP_NONCE__";
  const devNonce = "dev-nonce";
  return {
    name: "csp-nonce-dev",
    enforce: "pre" as const,
    transformIndexHtml(
      html: string,
      ctx: IndexHtmlTransformContext | undefined,
    ) {
      if (ctx?.server) {
        return html.split(placeholder).join(devNonce);
      }
      return html;
    },
  };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const modulePreloadChunks = [
  "ckeditor",
  "jspdf",
  "fast-png",
  "pako",
  "fflate",
];

const modulePreloadPattern = new RegExp(
  `<link\\s[^>]*rel=["']modulepreload["'][^>]*href=["'][^"']*(?:${modulePreloadChunks
    .map(escapeRegex)
    .join("|")})[^"']*["'][^>]*>`,
  "gi",
);

const fontPreloadPattern = /<link\s[^>]*rel=["'][^"']*preload[^"']*["'][^>]*href=["'][^"']*fonts\/fonts\.css["'][^>]*>/gi;

function filterModulePreloadLinks() {
  return {
    name: "filter-modulepreload-links",
    transformIndexHtml(html: string, ctx: IndexHtmlTransformContext | undefined) {
      if (ctx?.server) {
        return html;
      }
      const withoutModulePreload = html.replace(modulePreloadPattern, "");
      return withoutModulePreload.replace(fontPreloadPattern, (tag) => {
        const hasStylesheet = /rel=["'][^"']*stylesheet[^"']*["']/i.test(tag);
        const hasAsStyle = /\sas\s*=\s*["']style["']/i.test(tag);
        if (hasStylesheet && hasAsStyle) {
          return tag;
        }
        return "";
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const mapboxAccessToken = env.VITE_MAPBOX_ACCESS_TOKEN || "";
  const mapStyleUrl = env.VITE_MAPBOX_STYLE_URL || "mapbox://styles/mapbox/streets-v12";

  return {
    plugins: [
      react(),
      legacy(),
      splitVendorChunkPlugin(),
      inlineNonce(),
      sri(),
      ViteImageOptimizer(),
      process.env.ANALYZE
        ? visualizer({
            filename: "bundle-report.html",
            template: "treemap",
            open: true,
            gzipSize: true,
            brotliSize: true,
          })
        : undefined,
      preserveIndexHtml(),
      filterModulePreloadLinks(),
      cspNonceDevPlugin(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
        shared: resolve(__dirname, "../../packages/shared/src"),
        "react-intl": resolve(__dirname, "src/stubs/react-intl.tsx"),
      },
    },
    define: {
      __ERM_MAPBOX_ACCESS_TOKEN__: JSON.stringify(mapboxAccessToken),
      __ERM_MAP_STYLE_URL__: JSON.stringify(mapStyleUrl),
    },
    optimizeDeps: {
      exclude: ["@mapbox/node-pre-gyp"],
    },
    build: {
      emptyOutDir: true,
      outDir: "../api/public",
      manifest: true,
      // JS-файлы сохраняем в каталоге js
      assetsDir: "js",

      // Sourcemap включены для всех сборок
      sourcemap: true,
      minify: "esbuild",
      cssMinify: "lightningcss",
      treeshake: true,

      chunkSizeWarningLimit: 1500,
      commonjsOptions: {
        include: [/shared/, /node_modules/],
      },
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: [
              "react",
              "react-dom",
              "react-router-dom",
              "react-hook-form",
              "@hookform/resolvers",
              "zod",
              "@tanstack/react-table",
              "@tanstack/react-virtual",
              "validator",
              "clsx",
              "class-variance-authority",
            ],
            map: ["mapbox-gl", "maplibre-gl", "@mapbox/mapbox-gl-draw"],
          },
        },
      },
    },
  };
});
