// Представление чатов Telegram через tdweb
import React, { useEffect } from "react";
import TelegramApp from "telegram-react/src/TelegramApp";
import "telegram-react/src/TelegramApp.css";

export default function ChatView() {
  useEffect(() => {
    // Путь к файлам tdweb, скрипт setup_tdweb.sh копирует их в public/tdlib
    (window as any).__webpack_public_path__ = "/tdlib/";
  }, []);
  return (
    <div className="h-full">
      <TelegramApp />
    </div>
  );
}
