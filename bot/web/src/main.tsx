import React from "react";
import ReactDOM from "react-dom/client";
import TelegramApp from "./TelegramApp";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Element #root not found");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <TelegramApp />
  </React.StrictMode>,
);
