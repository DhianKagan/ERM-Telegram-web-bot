// Контекст аутентификации, запрашивает профиль и CSRF-токен
// Модули: React, services/auth, AuthContext
import { useEffect, useState, type ReactNode } from "react";
import { getProfile } from "../services/auth";
import { AuthContext } from "./AuthContext";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/v1/csrf", { credentials: "include" }).catch(() => {});
    getProfile()
      .then((u) => {
        setUser(u);
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
      });
  }, []);
  const logout = () => {
    setUser(null);
  };
  return (
    <AuthContext.Provider
      value={{ token: null, user, logout, setUser, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}
