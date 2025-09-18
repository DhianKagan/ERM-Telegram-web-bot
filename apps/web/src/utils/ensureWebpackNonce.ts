// Назначение файла: обеспечивает установку nonce для динамических стилей CKEditor.
// Основные модули: DOM API

declare global {
  interface Window {
    __webpack_nonce__?: string;
    __styleNonceObserver__?: MutationObserver;
  }
}

const INLINE_SCRIPT_SELECTOR = 'script[data-webpack-nonce]';
const STYLE_SELECTOR = 'style';

function applyNonceToStyle(style: HTMLStyleElement, nonce: string): void {
  if (!style.nonce) {
    style.setAttribute('nonce', nonce);
  }
}

function observeStyleNonce(nonce: string): void {
  if (window.__styleNonceObserver__) return;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLStyleElement) {
          applyNonceToStyle(node, nonce);
        } else if (node instanceof Element) {
          node
            .querySelectorAll<HTMLStyleElement>(STYLE_SELECTOR)
            .forEach((style) => applyNonceToStyle(style, nonce));
        }
      });
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  window.__styleNonceObserver__ = observer;
}

export function ensureWebpackNonce(): void {
  if (typeof window === 'undefined') return;
  if (window.__webpack_nonce__) {
    observeStyleNonce(window.__webpack_nonce__);
    return;
  }
  const script = document.querySelector<HTMLScriptElement>(
    INLINE_SCRIPT_SELECTOR,
  );
  const nonce = script?.nonce;
  if (nonce) {
    window.__webpack_nonce__ = nonce;
    document
      .querySelectorAll<HTMLStyleElement>(STYLE_SELECTOR)
      .forEach((style) => applyNonceToStyle(style, nonce));
    observeStyleNonce(nonce);
  }
}
