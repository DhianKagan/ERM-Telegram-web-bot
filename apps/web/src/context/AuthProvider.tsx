// Контекст аутентификации, запрашивает профиль и CSRF-токен, JWT не хранится
// Модули: React, services/auth, AuthContext, AuthActionsContext, utils/csrfToken
import { useEffect, useState, type ReactNode } from 'react';
import { getProfile, logout as apiLogout, refresh } from '../services/auth';
import { clearAnonTasksCache } from '../services/tasks';
import { taskStateController } from '../controllers/taskStateController';
import { AuthContext } from './AuthContext';
import { AuthActionsContext } from './AuthActionsContext';
import { setCsrfToken } from '../utils/csrfToken';
import { clearAccessToken, shouldUseBearerAuth } from '../lib/auth';
import type { User } from '../types/user';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUserState] = useState<User | null>(null);
  const setUser = (u: User | null) => {
    taskStateController.clear();
    setUserState(u);
    if (u) clearAnonTasksCache();
  };
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const loadCsrf = async () => {
      try {
        const res = await fetch('/api/v1/csrf', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (data.csrfToken) {
          setCsrfToken(data.csrfToken);
        }
      } catch {
        /* игнорируем */
      }
    };
    if (!shouldUseBearerAuth()) {
      loadCsrf();
    }
    const onVisible = () => {
      if (!document.hidden && !shouldUseBearerAuth()) loadCsrf();
    };
    if (!shouldUseBearerAuth()) {
      window.addEventListener('focus', loadCsrf);
    }
    document.addEventListener('visibilitychange', onVisible);
    getProfile({ noRedirect: true })
      .then((u) => {
        setUser(u);
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
      });
    return () => {
      if (!shouldUseBearerAuth()) {
        window.removeEventListener('focus', loadCsrf);
      }
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(
      () => {
        refresh().catch(() => {
          clearAccessToken();
          setUserState(null);
        });
      },
      4 * 60 * 1000,
    );

    return () => window.clearInterval(id);
  }, []);

  // logout полностью очищает кеш и закрывает мини-приложение
  const logout = async () => {
    await apiLogout();
    clearAccessToken();
    setUserState(null);
    try {
      clearAnonTasksCache();
      taskStateController.clear();
      localStorage.clear();
      sessionStorage.clear();
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      document.cookie.split(';').forEach((c) => {
        const eq = c.indexOf('=');
        const name = (eq > -1 ? c.slice(0, eq) : c).trim();
        if (name)
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      });
    } catch {
      /* игнорируем очистку */
    }
    if (window.Telegram?.WebApp) window.Telegram.WebApp.close();
  };
  return (
    <AuthContext.Provider value={{ user, loading }}>
      <AuthActionsContext.Provider value={{ setUser, logout }}>
        {children}
      </AuthActionsContext.Provider>
    </AuthContext.Provider>
  );
}
