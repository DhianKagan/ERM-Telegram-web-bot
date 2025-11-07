// Назначение: декларации глобальных полей объекта window.
// Основные модули: отсутствуют

declare global {
  interface Window {
    __ALERT_MESSAGE__?: string | null;
  }
}

export {};
