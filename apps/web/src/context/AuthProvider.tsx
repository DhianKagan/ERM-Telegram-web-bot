// Контекст аутентификации, запрашивает профиль и CSRF-токен, JWT не хранится
// Модули: React, services/auth, AuthContext
import { useEffect, useState, type ReactNode } from "react";
import { getProfile } from "../services/auth";
import { AuthContext } from "./AuthContext";
import { setCsrfToken } from "../utils/csrfToken";
import type { User } from "../types/user";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const loadCsrf = async () => {
      try {
        const res = await fetch("/api/v1/csrf", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (data.csrfToken) {
          setCsrfToken(data.csrfToken);
        }
      } catch {
        /* ignore */
      }
    };
    loadCsrf();
    const onVisible = () => {
      if (!document.hidden) loadCsrf();
    };
    window.addEventListener("focus", loadCsrf);
    document.addEventListener("visibilitychange", onVisible);
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
      window.removeEventListener("focus", loadCsrf);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const logout = () => {
    setUser(null);
  };
  return (
    <AuthContext.Provider value={{ user, logout, setUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
