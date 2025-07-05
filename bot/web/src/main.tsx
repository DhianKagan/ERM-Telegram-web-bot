import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Element #root not found");
}

const isBrowser = new URLSearchParams(window.location.search).get("browser") === "1";

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
  import("./TelegramApp").then(({ default: TelegramApp }) => render(TelegramApp));
}
