// Контекст темы без переключателя, поддерживается только светлая схема
import React, { createContext, useContext } from "react";

type Theme = "light";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeState | undefined>(undefined);

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("ThemeContext");
  return ctx;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const theme: Theme = "light";
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove("dark");
    document.body.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }
  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggle: () => {},
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
