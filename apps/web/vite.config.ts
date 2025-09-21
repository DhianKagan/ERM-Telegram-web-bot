/* eslint-env node */
/* eslint-disable no-undef */

/**
 * Назначение файла: конфигурация Vite для мини-приложения.
 * Основные модули: vite, @vitejs/plugin-react, @vitejs/plugin-legacy.
 */
import { defineConfig, type IndexHtmlTransformContext } from "vite";
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

function filterModulePreloadLinks() {
  return {
    name: "filter-modulepreload-links",
    transformIndexHtml(html: string, ctx: IndexHtmlTransformContext | undefined) {
      if (ctx?.server) {
        return html;
      }
      return html.replace(modulePreloadPattern, "");
    },
  };
}

const vendorChunkGroups: Record<string, string[]> = {
  "vendor-core": [
    "react",
    "react-dom",
    "scheduler",
    "react-is",
    "use-sync-external-store",
  ],
  "vendor-router": ["react-router", "react-router-dom", "@remix-run/router"],
  "vendor-i18n": ["i18next", "react-i18next"],
  "vendor-forms": [
    "react-hook-form",
    "@hookform/resolvers",
    "zod",
    "validator",
  ],
  "vendor-ui": [
    "@radix-ui/react-dialog",
    "@radix-ui/react-dropdown-menu",
    "@radix-ui/react-slot",
    "@radix-ui/react-tabs",
    "@radix-ui/react-visually-hidden",
    "clsx",
    "class-variance-authority",
    "tailwind-merge",
    "lucide-react",
    "next-themes",
    "@heroicons/react",
  ],
  "vendor-telegram": ["@telegram-apps/sdk-react", "@telegram-apps/telegram-ui"],
  "vendor-data": ["@tanstack/react-table", "match-sorter"],
  "vendor-visualization": [
    "apexcharts",
    "react-apexcharts",
    "chart.js",
    "react-chartjs-2",
  ],
  "vendor-dnd": ["@hello-pangea/dnd"],
  "vendor-filemanager": ["chonky", "react-jss"],
  "vendor-richtext": ["react-quill", "quill", "dompurify"],
  "vendor-maps": ["leaflet"],
};

const vendorChunkLookup = new Map<string, string>();
for (const [chunkName, packages] of Object.entries(vendorChunkGroups)) {
  for (const pkg of packages) {
    vendorChunkLookup.set(pkg, chunkName);
  }
}

function resolvePackageName(id: string) {
  const parts = id.split("node_modules/");
  const pkgPath = parts[parts.length - 1];
  const segments = pkgPath.split("/");
  if (segments[0]?.startsWith("@")) {
    return `${segments[0]}/${segments[1] || ""}`;
  }
  return segments[0];
}

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      react(),
      legacy(),
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
          // Разбиваем node_modules на отдельные чанки по именам пакетов
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return undefined;
            }
            const pkg = resolvePackageName(id);
            if (!pkg) {
              return undefined;
            }
            if (pkg.startsWith("@ckeditor/") || pkg.startsWith("ckeditor5")) {
              return "ckeditor";
            }
            if (pkg === "jspdf" || pkg === "jspdf-autotable") {
              return "jspdf";
            }
            if (pkg.startsWith("@radix-ui/")) {
              return "vendor-ui";
            }
            const mapped = vendorChunkLookup.get(pkg);
            if (mapped) {
              return mapped;
            }
            return "vendor-misc";
          },
        },
      },
    },
  };
});
