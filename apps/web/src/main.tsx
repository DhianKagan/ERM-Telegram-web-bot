// Точка входа: выбирает режим приложения (браузер или Telegram)
import React from 'react';
import * as ReactDOM from 'react-dom/client';
import ErrorBoundary from './components/ErrorBoundary';
import i18n from './i18n';
import './index.css';
import { ensureWebpackNonce } from './utils/ensureWebpackNonce';

ensureWebpackNonce();

function bootstrap() {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Element #root not found');
  }

  const params = new URLSearchParams(window.location.search);
  const forceBrowser = params.get('browser') === '1';

  const webApp = window.Telegram?.WebApp;
  const supportedPlatforms = ['android', 'ios', 'web', 'macos', 'tdesktop'];
  const minVersion = '6.0';

  function versionAtLeast(current: string, min: string) {
    const a = current.split('.').map(Number);
    const b = min.split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] || 0;
      const y = b[i] || 0;
      if (x > y) return true;
      if (x < y) return false;
    }
    return true;
  }

  let isTelegram = false;
  if (!forceBrowser && webApp) {
    isTelegram =
      supportedPlatforms.includes(webApp.platform) &&
      versionAtLeast(webApp.version, minVersion);
    if (!isTelegram) {
      window.__ALERT_MESSAGE__ =
        'Требуется обновление Telegram. Загружается браузерная версия.';
    }
  }

  function render(Component: React.ComponentType) {
    ReactDOM.createRoot(root).render(
      <ErrorBoundary
        fallback={
          <div>
            {i18n.t(
              'errorFallback',
              'Что-то пошло не так. Перезагрузите страницу (Ctrl+R или ⌘+R).',
            )}
          </div>
        }
      >
        <React.StrictMode>
          <Component />
        </React.StrictMode>
      </ErrorBoundary>,
    );
  }

  if (isTelegram) {
    import('./TelegramApp')
      .then(({ default: TelegramApp }) => render(TelegramApp))
      .catch((e) => console.error('Failed to load TelegramApp', e));
  } else {
    import('./App')
      .then(({ default: App }) => render(App))
      .catch((e) => console.error('Failed to load App', e));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
