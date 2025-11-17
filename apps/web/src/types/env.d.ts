// Назначение: декларация переменных окружения Vite для веб-клиента.
// Основные модули: отсутствуют.

declare global {
  interface ImportMetaEnv {
    readonly VITE_DISABLE_SSE?: string;
    readonly VITE_MAP_STYLE_URL?: string;
    readonly VITE_MAP_ADDRESSES_PMTILES_URL?: string;
    readonly VITE_LOGISTICS_POLL_INTERVAL_MS?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
