/* eslint-env node */
/* eslint-disable no-undef */

/**
 * Назначение файла: конфигурация Vite для мини-приложения.
 * Основные модули: vite, @vitejs/plugin-react.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import sri from "./plugins/sri";
import { visualizer } from "rollup-plugin-visualizer";

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

// https://vite.dev/config/
export default defineConfig(() => {
  const isCi = Boolean(process.env.CI);
  return {
    plugins: [
      react(),
      sri(),
      process.env.ANALYZE
        ? visualizer({
            filename: "bundle-report.html",
            template: "treemap",
            gzipSize: true,
            brotliSize: true,
          })
        : undefined,
      preserveIndexHtml(),
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
      // Карты исходников включены для всех окружений
      sourcemap: true,
      minify: isCi ? "esbuild" : false,
      chunkSizeWarningLimit: 1500,
      commonjsOptions: {
        include: [/shared/, /node_modules/],
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              const parts = id.toString().split("node_modules/");
              const pkgPath = parts[parts.length - 1].split("/");
              const pkg = pkgPath[0].startsWith("@")
                ? `${pkgPath[0]}/${pkgPath[1]}`
                : pkgPath[0];
              if (pkg.includes("@ckeditor")) return "ckeditor";
              return pkg.replace("@", "").replace("/", "-");
            }
          },
        },
      },
    },
  };
});
