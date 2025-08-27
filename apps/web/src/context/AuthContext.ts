// Контекст аутентификации
import { createContext } from "react";
import type { User } from "../types/user";

interface AuthContextType {
  token: string | null;
  user: User | null;
  loading: boolean;
  logout: () => void;
  setUser: (u: User | null) => void;
}

export const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  loading: true,
  logout: () => {},
  setUser: () => {},
});
