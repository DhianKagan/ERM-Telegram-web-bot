// Контекст действий аутентификации
import { createContext } from "react";
import type { User } from "../types/user";

interface AuthActionsContextType {
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
}

export const AuthActionsContext = createContext<AuthActionsContextType>({
  logout: async () => {},
  setUser: () => {},
});
