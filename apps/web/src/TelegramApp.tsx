// Обёртка приложения с интеграцией Telegram Mini App
import React from "react";
import { AppRoot } from "@telegram-apps/telegram-ui";
import { useLaunchParams } from "@telegram-apps/sdk-react";
import App from "./App";

export default function TelegramApp() {
  const lp = useLaunchParams(true);
  const scheme = lp?.themeParams?.colorScheme;
  const appearance = scheme === "dark" ? "dark" : "light";
  return (
    <AppRoot appearance={appearance}>
      <App />
    </AppRoot>
  );
}
