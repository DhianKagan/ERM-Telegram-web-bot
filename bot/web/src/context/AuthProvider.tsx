// Контекст аутентификации, хранит токен и пользователя
import { useEffect, useState, type ReactNode } from "react";
import { getProfile } from "../services/auth";
import { AuthContext } from "./AuthContext";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    getProfile()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);
  const logout = () => {
    setUser(null);
  };
  return (
    <AuthContext.Provider value={{ token: null, user, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
