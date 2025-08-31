// Точка входа: выбирает режим приложения (браузер или Telegram)
import React from "react";
import * as ReactDOM from "react-dom/client";
import ErrorBoundary from "./components/ErrorBoundary";
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
      <ErrorBoundary fallback={<div>Что-то пошло не так</div>}>
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
    import("./App").then(({ default: App }) => render(App));
  } else {
    import("./TelegramApp").then(({ default: TelegramApp }) =>
      render(TelegramApp),
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
