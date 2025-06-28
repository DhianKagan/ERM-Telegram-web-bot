// Страница чатов через TDLib
import React, { useEffect, useState } from "react";

export default function ChatView() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/tdlib/tdweb.js";
    script.onload = () => setReady(true);
    script.onerror = () => setError("Не удалось загрузить TDLib");
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!ready) return <div className="p-4">Загрузка TDLib...</div>;
  return <div id="telegram-container" className="h-[80vh]" />;
}

