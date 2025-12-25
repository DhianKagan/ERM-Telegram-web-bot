// Страница входа через код подтверждения
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../context/useToast';
import authFetch from '../utils/authFetch';

export default function CodeLogin() {
  const [telegramId, setTelegramId] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const { addToast } = useToast();
  const [params] = useSearchParams();
  const expired = params.get('expired');

  useEffect(() => {
    if (expired) {
      addToast('Сессия истекла, войдите снова', 'error');
    }
  }, [expired, addToast]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const r = await authFetch('/api/v1/auth/send_code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: Number(telegramId) }),
    });
    if (r.ok) {
      setSent(true);
      addToast('Код отправлен');
    } else {
      addToast('Не удалось отправить код', 'error');
    }
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    const res = await authFetch('/api/v1/auth/verify_code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: Number(telegramId), code }),
    });
    if (res.ok) {
      window.location.href = '/';
    } else {
      addToast('Неверный код', 'error');
    }
  }

  return (
    <form className="flex flex-col gap-2 p-4" onSubmit={sent ? verify : send}>
      <input
        id="code-login-telegram-id"
        name="telegramId"
        aria-label="Telegram ID"
        className="min-h-[var(--touch-target)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--color-muted)] placeholder-[var(--color-muted)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]"
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
          id="code-login-code"
          name="verificationCode"
          aria-label="Код подтверждения"
          className="min-h-[var(--touch-target)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--color-muted)] placeholder-[var(--color-muted)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]"
          placeholder="Код"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      )}
      <button
        type="submit"
        className="min-h-[var(--touch-target)] rounded-[var(--radius)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-primary-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]"
      >
        {sent ? 'Войти по коду' : 'Отправить код'}
      </button>
    </form>
  );
}
