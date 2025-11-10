// Назначение: декларация переменных окружения Vite для веб-клиента.
// Основные модули: отсутствуют.

interface ImportMetaEnv {
  readonly VITE_DISABLE_SSE?: string;
  readonly VITE_MAP_STYLE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
