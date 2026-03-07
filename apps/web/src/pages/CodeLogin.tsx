// Страница входа через код подтверждения или логин/пароль
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../context/useToast';
import { useAuth } from '../context/useAuth';
import { getProfile } from '../services/auth';
import authFetch from '../utils/authFetch';
import { setAccessToken, shouldUseBearerAuth } from '../lib/auth';

type LoginMode = 'telegram' | 'password';

export default function CodeLogin() {
  const navigate = useNavigate();
  const [telegramId, setTelegramId] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState<LoginMode>('telegram');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();
  const { setUser } = useAuth();
  const [params] = useSearchParams();
  const expired = params.get('expired');

  useEffect(() => {
    if (expired) {
      addToast('Сессия истекла, войдите снова', 'error');
    }
  }, [expired, addToast]);

  const sleep = (ms: number) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });

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
    let res: Response | null = null;
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      res = await authFetch('/api/v1/auth/verify_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: Number(telegramId), code }),
        noRedirect: true,
      });
      if (res.ok) {
        break;
      }
      if (res.status !== 400 || attempt === maxAttempts) {
        break;
      }
      const payload = (await res
        .clone()
        .json()
        .catch(() => ({}))) as { detail?: string };
      if (String(payload.detail || '').toLowerCase() !== 'invalid code') {
        break;
      }
      await sleep(500);
    }
    if (!res) {
      addToast('Неверный код', 'error');
      return;
    }
    if (res.ok) {
      if (shouldUseBearerAuth()) {
        const data = (await res.json().catch(() => ({}))) as {
          accessToken?: string;
          token?: string;
        };
        const nextToken = data.accessToken || data.token;
        if (nextToken) {
          setAccessToken(nextToken);
        }
      }
      navigate('/requests', { replace: true });
    } else {
      addToast('Неверный код', 'error');
    }
  }

  async function loginWithPassword(e?: React.FormEvent) {
    e?.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    const endpoint = shouldUseBearerAuth()
      ? '/api/v1/auth/login'
      : '/api/v1/auth/login_password';
    try {
      const res = await authFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        noRedirect: true,
      });

      if (res.ok) {
        if (shouldUseBearerAuth()) {
          const data = (await res.json().catch(() => ({}))) as {
            accessToken?: string;
            token?: string;
          };
          const nextToken = data.accessToken || data.token;
          if (nextToken) {
            setAccessToken(nextToken);
          }
        }
        const profile = await getProfile({ noRedirect: true });
        setUser(profile);
        navigate('/requests', { replace: true });
        return;
      }
      addToast('Неверный логин или пароль', 'error');
    } catch {
      addToast('Не удалось выполнить вход', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (mode === 'password') {
    return (
      <form className="flex flex-col gap-2 p-4" onSubmit={loginWithPassword}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h1 className="text-base font-semibold">Вход сервисного аккаунта</h1>
          <button
            type="button"
            className="text-sm text-primary underline"
            onClick={() => setMode('telegram')}
          >
            Войти по Telegram-коду
          </button>
        </div>
        <input
          id="password-login-username"
          name="username"
          aria-label="Логин"
          className="min-h-[var(--touch-target)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--color-muted)] placeholder-[var(--color-muted)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]"
          placeholder="Логин"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          id="password-login-password"
          name="password"
          type="password"
          aria-label="Пароль"
          className="min-h-[var(--touch-target)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--color-muted)] placeholder-[var(--color-muted)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-[var(--touch-target)] rounded-[var(--radius)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-primary-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]"
        >
          {isSubmitting ? 'Вход...' : 'Войти'}
        </button>
      </form>
    );
  }

  return (
    <form className="flex flex-col gap-2 p-4" onSubmit={sent ? verify : send}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h1 className="text-base font-semibold">Вход по Telegram</h1>
        <button
          type="button"
          className="text-sm text-primary underline"
          onClick={() => setMode('password')}
        >
          Сервисный аккаунт
        </button>
      </div>
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
