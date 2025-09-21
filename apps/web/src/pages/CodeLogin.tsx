// Страница входа через код подтверждения
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "../context/useToast";
import authFetch from "../utils/authFetch";

export default function CodeLogin() {
  const [telegramId, setTelegramId] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const { addToast } = useToast();
  const [params] = useSearchParams();

  useEffect(() => {
    if (params.get("expired")) {
      addToast("Сессия истекла, войдите снова", "error");
    }
  }, [params, addToast]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const r = await authFetch("/api/v1/auth/send_code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramId: Number(telegramId) }),
    });
    if (r.ok) {
      setSent(true);
      addToast("Код отправлен");
    } else {
      addToast("Не удалось отправить код", "error");
    }
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    const res = await authFetch("/api/v1/auth/verify_code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramId: Number(telegramId), code }),
    });
    if (res.ok) {
      window.location.href = "/";
    } else {
      addToast("Неверный код", "error");
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
        className="text-primary underline"
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
      <button type="submit" className="bg-primary p-2 text-white">
        {sent ? "Войти по коду" : "Отправить код"}
      </button>
    </form>
  );
}
