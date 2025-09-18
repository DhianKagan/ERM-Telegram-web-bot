// Назначение файла: обеспечивает установку nonce для динамических стилей CKEditor.
// Основные модули: DOM API

declare global {
  interface Window {
    __webpack_nonce__?: string;
  }
}

const INLINE_SCRIPT_SELECTOR = 'script[data-webpack-nonce]';

export function ensureWebpackNonce(): void {
  if (typeof window === 'undefined') return;
  if (window.__webpack_nonce__) return;
  const script = document.querySelector<HTMLScriptElement>(
    INLINE_SCRIPT_SELECTOR,
  );
  const nonce = script?.nonce;
  if (nonce) {
    window.__webpack_nonce__ = nonce;
  }
}
