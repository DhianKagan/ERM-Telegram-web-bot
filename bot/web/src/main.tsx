// Точка входа: выбирает режим приложения (браузер или Telegram)
import React from "react";
import * as ReactDOM from "react-dom/client";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Element #root not found");
}

const params = new URLSearchParams(window.location.search);
const forcedBrowser = params.get("browser") === "1";
const hasTelegram = typeof window.Telegram?.WebApp !== "undefined";
const isBrowser = forcedBrowser || !hasTelegram;

function render(Component: React.ComponentType) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Component />
    </React.StrictMode>,
  );
}

if (isBrowser) {
  import("./App").then(({ default: App }) => render(App));
} else {
  import("./TelegramApp").then(({ default: TelegramApp }) =>
    render(TelegramApp),
  );
}
