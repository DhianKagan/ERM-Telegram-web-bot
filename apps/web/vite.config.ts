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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sri()],
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
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          ckeditor: [
            "@ckeditor/ckeditor5-react",
            "@ckeditor/ckeditor5-build-classic",
          ],
          // чанк charts удалён: react-apexcharts загружается динамически
        },
      },
    },
  },
});
