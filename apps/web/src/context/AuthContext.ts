// Контекст аутентификации
import { createContext } from "react";

interface AuthContextType {
  token: string | null;
  user: Record<string, unknown> | null;
  loading: boolean;
  logout: () => void;
  setUser: (u: Record<string, unknown> | null) => void;
}

export const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  loading: true,
  logout: () => {},
  setUser: () => {},
});
