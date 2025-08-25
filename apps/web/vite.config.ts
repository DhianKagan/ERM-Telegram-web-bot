/* eslint-env node */
/* eslint-disable no-undef */

/**
 * Назначение файла: конфигурация Vite для мини-приложения.
 * Основные модули: vite, @vitejs/plugin-react.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import sri from "./plugins/sri";
import { visualizer } from "rollup-plugin-visualizer";

// https://vite.dev/config/
export default defineConfig(() => ({
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
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      shared: resolve(__dirname, "../../packages/shared/src"),
    },
  },
  build: {
    emptyOutDir: true,
    outDir: "../api/public",
    manifest: true,
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
            // Объединяем зависимости React и use-callback-ref в один чанк,
            // чтобы избежать циклической загрузки и ошибок useLayoutEffect.
            if (pkg.startsWith("react") || pkg.includes("use-callback-ref"))
              return "react";
            return pkg.replace("@", "").replace("/", "-");
          }
        },
      },
    },
  },
}));
