/* eslint-env node */
/* eslint-disable no-undef */

/**
 * Назначение файла: конфигурация Vite для мини-приложения.
 * Основные модули: vite, @vitejs/plugin-react, @vitejs/plugin-legacy.
 */
import { defineConfig, loadEnv, type IndexHtmlTransformContext } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import { resolve } from "path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
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

const requireModule = createRequire(import.meta.url);

function moduleExists(specifier: string): boolean {
  try {
    requireModule.resolve(specifier);
    return true;
  } catch {
    return false;
  }
}

function filterExistingModules(modules: readonly string[]): string[] {
  return modules.filter((moduleId) => moduleExists(moduleId));
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

type MapStyleMode = "pmtiles" | "raster";

function normalizeMapStyleMode(value: string | undefined): MapStyleMode | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (["pmtiles", "vector", "tiles"].includes(normalized)) {
    return "pmtiles";
  }
  if (["raster", "osm", "fallback"].includes(normalized)) {
    return "raster";
  }
  return undefined;
}

function resolveBuildMapStyleMode(
  env: Record<string, string | undefined>,
  mode: string,
): MapStyleMode {
  const explicit = normalizeMapStyleMode(env.VITE_MAP_STYLE_MODE);
  if (explicit) {
    return explicit;
  }
  const pmtilesHint = env.VITE_USE_PMTILES?.trim();
  if (pmtilesHint) {
    const useFallback = pmtilesHint === "0" || pmtilesHint.toLowerCase() === "false";
    return useFallback ? "raster" : "pmtiles";
  }
  const normalizedMode = mode.trim().toLowerCase();
  const isProduction = normalizedMode === "production" || normalizedMode === "production-build";
  return isProduction ? "pmtiles" : "raster";
}

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
  const mapStyleMode = resolveBuildMapStyleMode(env, mode);
  const shouldOptimizeImages = process.env.SKIP_IMAGE_OPTIMIZER !== "1";

  return {
    plugins: [
      react(),
      legacy(),
      inlineNonce(),
      sri(),
      shouldOptimizeImages ? ViteImageOptimizer() : undefined,
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
      alias: (() => {
        const entries: Record<string, string> = {
          "@": resolve(__dirname, "src"),
          shared: resolve(__dirname, "../../packages/shared/src"),
          "react-intl": resolve(__dirname, "src/stubs/react-intl.tsx"),
        };

        const mapLibreDrawModuleId = "@mapbox/mapbox-gl-draw";
        const mapLibreDrawStylesId = "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

        if (moduleExists(mapLibreDrawModuleId)) {
          entries["maplibre-gl-draw"] = requireModule.resolve(mapLibreDrawModuleId);
        }

        if (moduleExists(mapLibreDrawStylesId)) {
          entries["maplibre-gl-draw/dist/maplibre-gl-draw.css"] =
            requireModule.resolve(mapLibreDrawStylesId);
        }

        return entries;
      })(),
    },
    define: {
      __ERM_MAP_STYLE_MODE__: JSON.stringify(mapStyleMode),
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
            vendor: filterExistingModules([
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
            ]),
            map: filterExistingModules([
              "maplibre-gl",
              "maplibre-gl-draw",
              "pmtiles",
            ]),
          },
        },
      },
    },
  };
});
