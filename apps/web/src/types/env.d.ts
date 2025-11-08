// Назначение: декларация переменных окружения Vite для веб-клиента.
// Основные модули: отсутствуют.

interface ImportMetaEnv {
  readonly VITE_DISABLE_SSE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
