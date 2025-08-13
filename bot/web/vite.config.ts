
/**
 * Назначение файла: конфигурация Vite для мини-приложения.
 * Основные модули: vite, @vitejs/plugin-react.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';


// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {

    outDir: '../public',

    chunkSizeWarningLimit: 1500,
    commonjsOptions: {
      include: [/shared/, /node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks: {

          react: ['react', 'react-dom', 'react-router-dom'],

        },
      },
    },
  },
});
