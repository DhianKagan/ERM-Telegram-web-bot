// Назначение: отправка событий тоста вне React
// Основные модули: window, CustomEvent
export function showToast(
  message: string,
  type: 'success' | 'error' = 'error',
) {
  window.dispatchEvent(new CustomEvent('toast', { detail: { message, type } }));
}
