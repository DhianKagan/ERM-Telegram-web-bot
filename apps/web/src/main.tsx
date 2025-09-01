// Точка входа: выбирает режим приложения (браузер или Telegram)
import React from "react";
import * as ReactDOM from "react-dom/client";
import ErrorBoundary from "./components/ErrorBoundary";
import i18n from "./i18n";
import "./index.css";

function bootstrap() {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Element #root not found");
  }

  const params = new URLSearchParams(window.location.search);
  const forcedBrowser = params.get("browser") === "1";
  const canTranslate = Boolean(window.Telegram?.WebApp?.translate);
  const isBrowser = forcedBrowser || !canTranslate;

  function render(Component: React.ComponentType) {
    ReactDOM.createRoot(root).render(
      <ErrorBoundary
        fallback={
          <div>
            {i18n.t(
              "errorFallback",
              "Что-то пошло не так. Перезагрузите страницу (Ctrl+R или ⌘+R).",
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

  if (isBrowser) {
    if (!forcedBrowser) {
      alert("Пожалуйста, откройте приложение внутри Telegram");
    }
    import("./App")
      .then((mod) => {
        const App = (mod as any).default ?? (mod as any);
        console.log("App module keys:", Object.keys(mod as any));
        render(App);
      })
      .catch((e) => console.error("Failed to load App", e));
  } else {
    import("./TelegramApp")
      .then((mod) => render((mod as any).default ?? (mod as any)))
      .catch((e) => console.error("Failed to load TelegramApp", e));
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
