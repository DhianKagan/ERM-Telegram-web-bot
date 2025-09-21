// Контекст токенов темы интерфейса
// Модули: React
import { createContext } from "react";

export interface ThemeTokens {
  primary: string;
  background: string;
  foreground: string;
}

interface ThemeContextType {
  theme: string;
  setTheme: (t: string) => void;
  tokens: ThemeTokens;
  setTokens: (t: ThemeTokens) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  setTheme: () => {},
  tokens: { primary: "#2563EB", background: "#FFFFFF", foreground: "#1C2434" },
  setTokens: () => {},
});
