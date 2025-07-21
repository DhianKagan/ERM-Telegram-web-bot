// Страница входа через код подтверждения
import React, { useState } from "react";

export default function CodeLogin() {
  const [telegramId, setTelegramId] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    await fetch("/api/v1/auth/send_code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ telegramId: Number(telegramId) }),
    });
    setSent(true);
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    const res = await fetch("/api/v1/auth/verify_code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ telegramId: Number(telegramId), code }),
    });
    if (res.ok) {
      window.location.href = "/";
    }
  }

  return (
    <form className="flex flex-col gap-2 p-4" onSubmit={sent ? verify : send}>
      <input
        className="border p-2"
        placeholder="Telegram ID"
        value={telegramId}
        onChange={(e) => setTelegramId(e.target.value)}
      />
      <a
        className="text-blue-500 underline"
        href="https://telegram.me/userinfobot"
        target="_blank"
        rel="noopener"
      >
        Узнать свой ID через @userinfobot
      </a>
      {sent && (
        <input
          className="border p-2"
          placeholder="Код"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      )}
      <button type="submit" className="bg-blue-500 p-2 text-white">
        {sent ? "Войти по коду" : "Отправить код"}
      </button>
    </form>
  );
}
